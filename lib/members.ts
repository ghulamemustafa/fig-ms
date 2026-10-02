import "server-only";

import { prisma } from "@/lib/prisma";
import { auditCreate, auditUpdate, logAudit } from "@/lib/audit";
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

export type MemberListFilters = {
  status?: MemberStatus;
  search?: string;
};

function memberListWhere(filters: MemberListFilters) {
  const insensitive = { mode: "insensitive" as const };
  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search, ...insensitive } },
            { cnic: { contains: filters.search, ...insensitive } },
            { serialNo: { contains: filters.search, ...insensitive } },
            { mobile: { contains: filters.search, ...insensitive } },
          ],
        }
      : {}),
  };
}

/** Total rows matching the filters — pairs with `listMembers` for pagination. */
export async function countMembers(filters: MemberListFilters) {
  return prisma.member.count({ where: memberListWhere(filters) });
}

export async function listMembers(
  params: MemberListFilters & {
    limit?: number;
    /** 1-based page number. Requires `pageSize`. */
    page?: number;
    pageSize?: number;
  }
) {
  const where = memberListWhere(params);
  const take = params.pageSize ?? params.limit;
  const skip = params.pageSize ? (Math.max(1, params.page ?? 1) - 1) * params.pageSize : 0;

  const members = await prisma.member.findMany({
    where,
    orderBy: { serialNo: "asc" },
    ...(take ? { take } : {}),
    ...(skip ? { skip } : {}),
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

export async function createMember(input: CreateMemberInput, changedBy: string) {
  await assertUnique(input);

  const { dependents, originalJoinDate, ...fields } = input;

  return prisma.$transaction(async (tx) => {
    const member = await tx.member.create({
      data: {
        ...fields,
        originalJoinDate,
        currentJoinDate: originalJoinDate, // fresh registration: both start equal
        status: "active",
        dependents: { create: dependentCreateData(dependents) },
      },
      include: { dependents: true },
    });

    const { dependents: created, ...memberRow } = member;
    await auditCreate(tx, { entityType: "Member", record: memberRow, changedBy, memberId: member.id });
    for (const dep of created) {
      await auditCreate(tx, { entityType: "Dependent", record: dep, changedBy, memberId: member.id });
    }
    return member;
  });
}

export async function updateMember(id: string, input: UpdateMemberInput, changedBy: string) {
  await assertUnique(input, id);

  const { dependents, ...fields } = input;

  const existing = await prisma.dependent.findMany({ where: { memberId: id } });
  const keptIds = new Set(dependents.filter((d) => d.id).map((d) => d.id));
  const toDelete = existing.filter((d) => !keptIds.has(d.id));

  return prisma.$transaction(async (tx) => {
    const before = await tx.member.findUniqueOrThrow({ where: { id } });

    for (const gone of toDelete) {
      await tx.dependent.delete({ where: { id: gone.id } });
      await logAudit(tx, {
        entityType: "Dependent",
        entityId: gone.id,
        action: "delete",
        changedBy,
        changes: gone,
        memberId: id,
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
        const prev = existing.find((d) => d.id === dep.id);
        const next = await tx.dependent.update({ where: { id: dep.id }, data });
        if (prev) {
          await auditUpdate(tx, { entityType: "Dependent", before: prev, after: next, changedBy, memberId: id });
        }
      } else {
        const created = await tx.dependent.create({ data: { ...data, memberId: id } });
        await auditCreate(tx, { entityType: "Dependent", record: created, changedBy, memberId: id });
      }
    }

    const after = await tx.member.update({
      where: { id },
      data: fields,
      include: { dependents: true },
    });
    const { dependents: _deps, ...afterRow } = after;
    void _deps;
    await auditUpdate(tx, { entityType: "Member", before, after: afterRow, changedBy, memberId: id });
    return after;
  });
}

/** Soft removal. The reason lands in both the Member row and the audit entry. */
export async function removeMember(id: string, reason: string, changedBy: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.member.findUniqueOrThrow({ where: { id } });
    const after = await tx.member.update({
      where: { id },
      data: { status: "removed", removedDate: new Date(), removedReason: reason },
    });
    await auditUpdate(tx, {
      entityType: "Member",
      before,
      after,
      changedBy,
      memberId: id,
      extra: { event: "removed", reason },
    });
    return after;
  });
}

/**
 * Marks the member deceased and creates/links a successor who inherits
 * originalJoinDate (immediate fund eligibility) with currentJoinDate = now.
 */
export async function succeedMember(
  deceasedId: string,
  input: SucceedMemberInput,
  changedBy: string
) {
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
      await auditCreate(tx, {
        entityType: "Member",
        record: successor,
        changedBy,
        memberId: successor.id,
      });
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
        include: { dependents: true },
      });
      successorId = successor.id;
      const { dependents: createdDeps, ...successorRow } = successor;
      await auditCreate(tx, { entityType: "Member", record: successorRow, changedBy, memberId: successor.id });
      for (const dep of createdDeps) {
        await auditCreate(tx, { entityType: "Dependent", record: dep, changedBy, memberId: successor.id });
      }
    }

    const deceasedAfter = await tx.member.update({
      where: { id: deceasedId },
      data: { status: "deceased", removedDate, succeededById: successorId },
    });
    await auditUpdate(tx, {
      entityType: "Member",
      before: deceased,
      after: deceasedAfter,
      changedBy,
      memberId: deceasedId,
      extra: { event: "deceased", successorId, successorMode: input.mode },
    });

    return tx.member.findUniqueOrThrow({ where: { id: successorId } });
  });
}
