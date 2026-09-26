import "server-only";

import { prisma } from "@/lib/prisma";
import { getFundEligibilityDetail, isFundEligible, consecutiveUnpaidMonths } from "@/lib/rules";
import type {
  CreateMemberInput,
  DependentInput,
  SucceedMemberInput,
  UpdateMemberInput,
} from "@/lib/schemas/member";

export type MemberStatus = "active" | "removed" | "deceased";

/**
 * Thrown when a create/update would violate a uniqueness rule (cnic/serialNo).
 * Route handlers catch this and map it onto a field-level form error.
 */
export class DuplicateFieldError extends Error {
  constructor(
    public field: "cnic" | "serialNo",
    message: string
  ) {
    super(message);
  }
}

async function assertUnique(
  fields: { cnic: string; serialNo: string },
  excludeId?: string
) {
  const [byCnic, bySerial] = await Promise.all([
    prisma.member.findUnique({ where: { cnic: fields.cnic } }),
    prisma.member.findUnique({ where: { serialNo: fields.serialNo } }),
  ]);
  if (byCnic && byCnic.id !== excludeId) {
    throw new DuplicateFieldError("cnic", "This CNIC is already registered.");
  }
  if (bySerial && bySerial.id !== excludeId) {
    throw new DuplicateFieldError(
      "serialNo",
      "This serial number is already in use."
    );
  }
}

export async function listMembers(params: {
  status?: MemberStatus;
  search?: string;
}) {
  const where = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.search
      ? {
          OR: [
            { name: { contains: params.search, mode: "insensitive" as const } },
            { cnic: { contains: params.search } },
            { serialNo: { contains: params.search } },
            { mobile: { contains: params.search } },
          ],
        }
      : {}),
  };

  const members = await prisma.member.findMany({
    where,
    orderBy: { serialNo: "asc" },
  });

  const withEligibility = await Promise.all(
    members.map(async (member) => ({
      ...member,
      fundEligible: await isFundEligible(member),
    }))
  );

  return withEligibility;
}

export async function getMemberById(id: string) {
  const member = await prisma.member.findUnique({
    where: { id },
    include: {
      dependents: true,
      payments: { orderBy: { monthCovered: "desc" } },
      payouts: { orderBy: { id: "desc" } },
      predecessor: { select: { id: true, name: true, serialNo: true } },
      succeededBy: { select: { id: true, name: true, serialNo: true } },
    },
  });
  if (!member) return null;

  const [eligibilityDetail, unpaidMonths] = await Promise.all([
    getFundEligibilityDetail(member),
    Promise.resolve(consecutiveUnpaidMonths(member, member.payments)),
  ]);

  return {
    ...member,
    fundEligible: eligibilityDetail.eligible,
    eligibilityDetail,
    unpaidMonths,
  };
}

function dependentCreateData(dependents: DependentInput[]) {
  return dependents.map((d) => ({
    name: d.name,
    relation: d.relation,
    maritalStatus: d.maritalStatus,
    dob: d.dob,
    occupation: d.occupation,
    notes: d.notes || null,
  }));
}

// NOTE: each of these is a single, self-contained mutation — the intended
// hook point for step 11's audit logging (wrap the call, diff before/after,
// write an AuditLog row keyed to entityType "Member").

export async function createMember(input: CreateMemberInput) {
  await assertUnique(input);

  const { dependents, originalJoinDate, ...fields } = input;

  return prisma.member.create({
    data: {
      ...fields,
      originalJoinDate,
      currentJoinDate: originalJoinDate, // fresh registration: both start equal
      status: "active",
      dependents: { create: dependentCreateData(dependents) },
    },
    include: { dependents: true },
  });
}

export async function updateMember(id: string, input: UpdateMemberInput) {
  await assertUnique(input, id);

  const { dependents, ...fields } = input;

  const existing = await prisma.dependent.findMany({ where: { memberId: id } });
  const keptIds = new Set(dependents.filter((d) => d.id).map((d) => d.id));
  const toDelete = existing.filter((d) => !keptIds.has(d.id));

  return prisma.$transaction(async (tx) => {
    if (toDelete.length > 0) {
      await tx.dependent.deleteMany({
        where: { id: { in: toDelete.map((d) => d.id) } },
      });
    }

    for (const dep of dependents) {
      const data = {
        name: dep.name,
        relation: dep.relation,
        maritalStatus: dep.maritalStatus,
        dob: dep.dob,
        occupation: dep.occupation,
        notes: dep.notes || null,
      };
      if (dep.id) {
        await tx.dependent.update({ where: { id: dep.id }, data });
      } else {
        await tx.dependent.create({ data: { ...data, memberId: id } });
      }
    }

    return tx.member.update({
      where: { id },
      data: fields,
      include: { dependents: true },
    });
  });
}

export async function removeMember(id: string, reason: string) {
  return prisma.member.update({
    where: { id },
    data: {
      status: "removed",
      removedDate: new Date(),
      removedReason: reason,
    },
  });
}

/**
 * Marks `deceasedId` deceased and creates/links a successor who inherits
 * originalJoinDate (immediate fund eligibility) with currentJoinDate = now.
 */
export async function succeedMember(deceasedId: string, input: SucceedMemberInput) {
  const deceased = await prisma.member.findUnique({ where: { id: deceasedId } });
  if (!deceased) throw new Error("Member not found");
  if (deceased.succeededById) {
    throw new Error("This member already has a recorded successor");
  }

  const removedDate = input.removedDate ?? new Date();
  const currentJoinDate = new Date();

  return prisma.$transaction(async (tx) => {
    let successorId: string;

    if (input.mode === "promoteDependent") {
      const dependent = await tx.dependent.findUnique({
        where: { id: input.dependentId },
      });
      if (!dependent || dependent.memberId !== deceasedId) {
        throw new Error("Dependent not found on this member");
      }
      await assertUnique({ cnic: input.cnic, serialNo: input.serialNo });
      const successor = await tx.member.create({
        data: {
          name: dependent.name,
          fatherName: input.fatherName,
          cnic: input.cnic,
          serialNo: input.serialNo,
          mobile: input.mobile,
          address: input.address,
          maritalStatus: dependent.maritalStatus,
          occupation: dependent.occupation,
          income: input.income,
          dob: dependent.dob,
          originalJoinDate: deceased.originalJoinDate,
          currentJoinDate,
          status: "active",
        },
      });
      successorId = successor.id;
    } else {
      await assertUnique({ cnic: input.cnic, serialNo: input.serialNo });
      const successor = await tx.member.create({
        data: {
          name: input.name,
          fatherName: input.fatherName,
          cnic: input.cnic,
          serialNo: input.serialNo,
          mobile: input.mobile,
          address: input.address,
          maritalStatus: input.maritalStatus,
          occupation: input.occupation,
          income: input.income,
          dob: input.dob,
          originalJoinDate: deceased.originalJoinDate,
          currentJoinDate,
          status: "active",
          dependents: { create: dependentCreateData(input.dependents) },
        },
      });
      successorId = successor.id;
    }

    await tx.member.update({
      where: { id: deceasedId },
      data: {
        status: "deceased",
        removedDate,
        succeededById: successorId,
      },
    });

    return tx.member.findUniqueOrThrow({ where: { id: successorId } });
  });
}
