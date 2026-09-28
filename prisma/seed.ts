import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";

// Shared dev-only password for every seeded user — never use this pattern
// for real accounts. See the login-testing instructions for how to use it.
const SEED_USER_PASSWORD = "Password123!";

/**
 * Scenario dates are fixed relative to a reference "today" of 2026-09-26 (when this
 * seed was authored), not computed from the real current date. Re-running this script
 * later still produces the same fixtures — "missed last 2/3 months" always means
 * relative to Sep 2026, which is what makes the removal/defaulter scenarios line up.
 */
function d(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

const BASE_FEE = 500; // placeholder PKR value — spec leaves the real amount to the committee
const NEW_MEMBER_MULTIPLIER = 2;
const SETTINGS_EFFECTIVE_FROM = d(2020, 1, 1);

let receiptSeq = 0;
function nextReceiptNo() {
  receiptSeq += 1;
  return `RC-${String(receiptSeq).padStart(6, "0")}`;
}

async function main() {
  console.log("Seeding settings...");
  const settingDefs = [
    { key: "baseFee", value: String(BASE_FEE) },
    { key: "newMemberMultiplier", value: String(NEW_MEMBER_MULTIPLIER) },
    { key: "newMemberMonths", value: "3" },
    { key: "eligibilityMonths", value: "3" },
    { key: "removalMonths", value: "3" },
    { key: "requirePayoutApproval", value: "true" },
  ];
  for (const s of settingDefs) {
    await prisma.setting.upsert({
      where: {
        key_effectiveFrom: { key: s.key, effectiveFrom: SETTINGS_EFFECTIVE_FROM },
      },
      update: { value: s.value },
      create: { ...s, effectiveFrom: SETTINGS_EFFECTIVE_FROM },
    });
  }

  console.log("Seeding users...");
  const userDefs = [
    { email: "admin@fwc.local", name: "Ayesha Admin", role: "admin" },
    { email: "treasurer@fwc.local", name: "Tariq Treasurer", role: "treasurer" },
    { email: "vp@fwc.local", name: "Nadia VP", role: "vp" },
    { email: "president@fwc.local", name: "Imran President", role: "president" },
    { email: "dataentry@fwc.local", name: "Sana DataEntry", role: "data_entry" },
  ] as const;

  const hashedSeedPassword = await bcrypt.hash(SEED_USER_PASSWORD, 10);

  const usersByRole: Record<string, { id: string }> = {};
  for (const u of userDefs) {
    usersByRole[u.role] = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, password: hashedSeedPassword },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        password: hashedSeedPassword,
      },
    });
  }
  const treasurer = usersByRole["treasurer"];
  const dataEntry = usersByRole["data_entry"];
  const admin = usersByRole["admin"];

  console.log("Seeding members...");

  type MemberSeed = {
    serialNo: string;
    name: string;
    fatherName: string;
    cnic: string;
    mobile: string;
    address: string;
    maritalStatus: string;
    occupation: string;
    income: number;
    dob: Date;
    originalJoinDate: Date;
    currentJoinDate: Date;
    status: "active" | "removed" | "deceased";
    removedDate?: Date | null;
    removedReason?: string | null;
  };

  // 1. New member — joined <3 months ago, still inside the 2x-fee window.
  const m1Ali: MemberSeed = {
    serialNo: "FWC-0001",
    name: "Ali Raza",
    fatherName: "Muhammad Raza",
    cnic: "35201-1111111-1",
    mobile: "0300-1111111",
    address: "House 12, Street 4, Model Town, Lahore",
    maritalStatus: "married",
    occupation: "Shopkeeper",
    income: 45000,
    dob: d(1990, 4, 12),
    originalJoinDate: d(2026, 8, 5),
    currentJoinDate: d(2026, 8, 5),
    status: "active",
  };

  // 2. Normal active member — joined years ago, fully paid up.
  const m2Yaqoob: MemberSeed = {
    serialNo: "FWC-0002",
    name: "Muhammad Yaqoob",
    fatherName: "Ghulam Nabi",
    cnic: "35201-2222222-2",
    mobile: "0301-2222222",
    address: "House 5, Street 9, Gulberg, Lahore",
    maritalStatus: "married",
    occupation: "Government Employee",
    income: 65000,
    dob: d(1975, 11, 3),
    originalJoinDate: d(2015, 3, 10),
    currentJoinDate: d(2015, 3, 10),
    status: "active",
  };

  // 3. 1-2 consecutive missed months (Aug + Sep 2026) — not yet removal-eligible.
  const m3Nasreen: MemberSeed = {
    serialNo: "FWC-0003",
    name: "Nasreen Bibi",
    fatherName: "Fazal Hussain",
    cnic: "35201-3333333-3",
    mobile: "0302-3333333",
    address: "House 22, Street 1, Township, Lahore",
    maritalStatus: "widowed",
    occupation: "Tailor",
    income: 25000,
    dob: d(1968, 6, 20),
    originalJoinDate: d(2018, 1, 15),
    currentJoinDate: d(2018, 1, 15),
    status: "active",
  };

  // 4. 3+ consecutive missed months (Jul, Aug, Sep 2026) — flagged for admin review.
  const m4Karim: MemberSeed = {
    serialNo: "FWC-0004",
    name: "Karim Baksh",
    fatherName: "Allah Ditta",
    cnic: "35201-4444444-4",
    mobile: "0303-4444444",
    address: "Chak 45, Tehsil Depalpur, Okara",
    maritalStatus: "married",
    occupation: "Farmer",
    income: 20000,
    dob: d(1972, 2, 14),
    originalJoinDate: d(2016, 6, 1),
    currentJoinDate: d(2016, 6, 1),
    status: "active",
  };

  // 5. Rejoined member — removed in 2023, rejoined 2025-06-01. originalJoinDate untouched,
  // currentJoinDate reset to the rejoin date, no 2x re-trigger. removedDate/removedReason
  // are cleared since status is active again; the prior removal is historical only (no
  // separate rejoin-history table in the spec — audit logging of this event is step 11).
  const m5Saleem: MemberSeed = {
    serialNo: "FWC-0005",
    name: "Saleem Akhtar",
    fatherName: "Karam Elahi",
    cnic: "35201-5555555-5",
    mobile: "0304-5555555",
    address: "House 8, Street 3, Samanabad, Lahore",
    maritalStatus: "married",
    occupation: "Driver",
    income: 30000,
    dob: d(1980, 9, 9),
    originalJoinDate: d(2014, 1, 1),
    currentJoinDate: d(2025, 6, 1),
    status: "active",
    removedDate: null,
    removedReason: null,
  };

  // 6. Deceased member — membership ends, family becomes funeral-fund eligible.
  const m6Abdul: MemberSeed = {
    serialNo: "FWC-0006",
    name: "Abdul Hameed",
    fatherName: "Noor Muhammad",
    cnic: "35201-6666666-6",
    mobile: "0305-6666666",
    address: "House 15, Street 6, Iqbal Town, Lahore",
    maritalStatus: "married",
    occupation: "Retired",
    income: 15000,
    dob: d(1955, 1, 1),
    originalJoinDate: d(2010, 5, 1),
    currentJoinDate: d(2010, 5, 1),
    status: "deceased",
    removedDate: d(2026, 5, 10),
    removedReason: null,
  };

  // 7. Successor — inherits M6's originalJoinDate (immediate fund eligibility).
  // Per confirmed decision: succession does NOT re-trigger the 2x new-member fee,
  // same treatment as a rejoin — they're continuing the family's paid membership.
  const m7Bilal: MemberSeed = {
    serialNo: "FWC-0007",
    name: "Bilal Hameed",
    fatherName: "Abdul Hameed",
    cnic: "35201-7777777-7",
    mobile: "0306-7777777",
    address: "House 15, Street 6, Iqbal Town, Lahore",
    maritalStatus: "married",
    occupation: "Teacher",
    income: 40000,
    dob: d(1992, 3, 15),
    originalJoinDate: m6Abdul.originalJoinDate, // inherited
    currentJoinDate: d(2026, 5, 20),
    status: "active",
  };

  // 8. Normal active member with dependents.
  const m8Farida: MemberSeed = {
    serialNo: "FWC-0008",
    name: "Farida Khatoon",
    fatherName: "Ashraf Ali",
    cnic: "35201-8888888-8",
    mobile: "0307-8888888",
    address: "House 30, Street 2, Johar Town, Lahore",
    maritalStatus: "widowed",
    occupation: "Housewife",
    income: 18000,
    dob: d(1965, 7, 22),
    originalJoinDate: d(2019, 2, 1),
    currentJoinDate: d(2019, 2, 1),
    status: "active",
  };

  // 9. Normal active member with a dependent.
  const m9Yasir: MemberSeed = {
    serialNo: "FWC-0009",
    name: "Yasir Mehmood",
    fatherName: "Rasheed Ahmed",
    cnic: "35201-9999999-9",
    mobile: "0308-9999999",
    address: "House 41, Street 7, Wapda Town, Lahore",
    maritalStatus: "married",
    occupation: "Bank Officer",
    income: 70000,
    dob: d(1988, 12, 1),
    originalJoinDate: d(2021, 4, 10),
    currentJoinDate: d(2021, 4, 10),
    status: "active",
  };

  const memberDefs = [
    m1Ali,
    m2Yaqoob,
    m3Nasreen,
    m4Karim,
    m5Saleem,
    m6Abdul,
    m7Bilal,
    m8Farida,
    m9Yasir,
  ];

  const membersByCnic: Record<string, { id: string }> = {};
  for (const mDef of memberDefs) {
    const { cnic, ...rest } = mDef;
    membersByCnic[cnic] = await prisma.member.upsert({
      where: { cnic },
      update: rest,
      create: { cnic, ...rest },
    });
  }

  // Link the succession: the deceased member's record points at their successor.
  await prisma.member.update({
    where: { cnic: m6Abdul.cnic },
    data: { succeededById: membersByCnic[m7Bilal.cnic].id },
  });

  console.log("Seeding dependents...");
  await prisma.dependent.deleteMany({
    where: {
      memberId: {
        in: [m2Yaqoob, m5Saleem, m8Farida, m9Yasir].map(
          (m) => membersByCnic[m.cnic].id
        ),
      },
    },
  });
  const dependentDefs = [
    {
      member: m2Yaqoob,
      name: "Shabana Yaqoob",
      relation: "spouse",
      maritalStatus: "married",
      dob: d(1978, 1, 1),
      occupation: "Housewife",
    },
    {
      member: m5Saleem,
      name: "Rukhsana Saleem",
      relation: "spouse",
      maritalStatus: "married",
      dob: d(1985, 5, 5),
      occupation: "Housewife",
    },
    {
      member: m5Saleem,
      name: "Adeel Saleem",
      relation: "son",
      maritalStatus: "single",
      dob: d(2010, 8, 8),
      occupation: "Student",
    },
    {
      member: m8Farida,
      name: "Sana Farida",
      relation: "daughter",
      maritalStatus: "single",
      dob: d(2000, 1, 1),
      occupation: "Student",
    },
    {
      member: m8Farida,
      name: "Usman Farida",
      relation: "son",
      maritalStatus: "single",
      dob: d(2003, 1, 1),
      occupation: "Student",
    },
    {
      member: m9Yasir,
      name: "Mahwish Yasir",
      relation: "spouse",
      maritalStatus: "married",
      dob: d(1990, 2, 2),
      occupation: "Housewife",
    },
  ];
  for (const dep of dependentDefs) {
    await prisma.dependent.create({
      data: {
        memberId: membersByCnic[dep.member.cnic].id,
        name: dep.name,
        relation: dep.relation,
        maritalStatus: dep.maritalStatus,
        dob: dep.dob,
        occupation: dep.occupation,
      },
    });
  }

  console.log("Seeding payments...");
  await prisma.payment.deleteMany({
    where: { memberId: { in: Object.values(membersByCnic).map((m) => m.id) } },
  });

  type PaymentSeed = {
    member: MemberSeed;
    year: number;
    month: number; // 1-12
    amount: number;
    wasDoubleFee: boolean;
    paidDay: number; // day of month paid, on/before the 15th due date
    recordedBy: { id: string };
  };

  const paymentDefs: PaymentSeed[] = [
    // 1. New member — both months so far billed at 2x.
    { member: m1Ali, year: 2026, month: 8, amount: BASE_FEE * 2, wasDoubleFee: true, paidDay: 12, recordedBy: treasurer },
    { member: m1Ali, year: 2026, month: 9, amount: BASE_FEE * 2, wasDoubleFee: true, paidDay: 10, recordedBy: treasurer },

    // 2. Normal active member — up to date.
    { member: m2Yaqoob, year: 2026, month: 7, amount: BASE_FEE, wasDoubleFee: false, paidDay: 9, recordedBy: treasurer },
    { member: m2Yaqoob, year: 2026, month: 8, amount: BASE_FEE, wasDoubleFee: false, paidDay: 11, recordedBy: treasurer },
    { member: m2Yaqoob, year: 2026, month: 9, amount: BASE_FEE, wasDoubleFee: false, paidDay: 8, recordedBy: dataEntry },

    // 3. Paid through Jul 2026, then missing Aug + Sep 2026 (2 consecutive).
    { member: m3Nasreen, year: 2026, month: 6, amount: BASE_FEE, wasDoubleFee: false, paidDay: 14, recordedBy: treasurer },
    { member: m3Nasreen, year: 2026, month: 7, amount: BASE_FEE, wasDoubleFee: false, paidDay: 13, recordedBy: treasurer },

    // 4. Paid through Jun 2026, then missing Jul + Aug + Sep 2026 (3 consecutive).
    { member: m4Karim, year: 2026, month: 5, amount: BASE_FEE, wasDoubleFee: false, paidDay: 15, recordedBy: dataEntry },
    { member: m4Karim, year: 2026, month: 6, amount: BASE_FEE, wasDoubleFee: false, paidDay: 12, recordedBy: dataEntry },

    // 5. Rejoined — arrears payment at rejoin, then resumed normal (no 2x) payments.
    { member: m5Saleem, year: 2025, month: 6, amount: BASE_FEE, wasDoubleFee: false, paidDay: 1, recordedBy: treasurer },
    { member: m5Saleem, year: 2026, month: 7, amount: BASE_FEE, wasDoubleFee: false, paidDay: 10, recordedBy: treasurer },
    { member: m5Saleem, year: 2026, month: 8, amount: BASE_FEE, wasDoubleFee: false, paidDay: 9, recordedBy: treasurer },
    { member: m5Saleem, year: 2026, month: 9, amount: BASE_FEE, wasDoubleFee: false, paidDay: 11, recordedBy: treasurer },

    // 6. Deceased member — last payments before death (2026-05-10).
    { member: m6Abdul, year: 2026, month: 3, amount: BASE_FEE, wasDoubleFee: false, paidDay: 10, recordedBy: treasurer },
    { member: m6Abdul, year: 2026, month: 4, amount: BASE_FEE, wasDoubleFee: false, paidDay: 12, recordedBy: treasurer },

    // 7. Successor — normal fee from the start (see succession-fee decision above).
    { member: m7Bilal, year: 2026, month: 6, amount: BASE_FEE, wasDoubleFee: false, paidDay: 14, recordedBy: treasurer },
    { member: m7Bilal, year: 2026, month: 7, amount: BASE_FEE, wasDoubleFee: false, paidDay: 10, recordedBy: treasurer },
    { member: m7Bilal, year: 2026, month: 8, amount: BASE_FEE, wasDoubleFee: false, paidDay: 9, recordedBy: treasurer },
    { member: m7Bilal, year: 2026, month: 9, amount: BASE_FEE, wasDoubleFee: false, paidDay: 13, recordedBy: dataEntry },

    // 8. Normal active member — up to date.
    { member: m8Farida, year: 2026, month: 7, amount: BASE_FEE, wasDoubleFee: false, paidDay: 8, recordedBy: dataEntry },
    { member: m8Farida, year: 2026, month: 8, amount: BASE_FEE, wasDoubleFee: false, paidDay: 9, recordedBy: dataEntry },
    { member: m8Farida, year: 2026, month: 9, amount: BASE_FEE, wasDoubleFee: false, paidDay: 7, recordedBy: dataEntry },

    // 9. Normal active member — up to date.
    { member: m9Yasir, year: 2026, month: 7, amount: BASE_FEE, wasDoubleFee: false, paidDay: 11, recordedBy: treasurer },
    { member: m9Yasir, year: 2026, month: 8, amount: BASE_FEE, wasDoubleFee: false, paidDay: 12, recordedBy: treasurer },
    { member: m9Yasir, year: 2026, month: 9, amount: BASE_FEE, wasDoubleFee: false, paidDay: 10, recordedBy: treasurer },
  ];

  for (const p of paymentDefs) {
    const monthCovered = d(p.year, p.month, 1);
    const dueDate = d(p.year, p.month, 15);
    const paidDate = d(p.year, p.month, p.paidDay);
    await prisma.payment.create({
      data: {
        memberId: membersByCnic[p.member.cnic].id,
        monthCovered,
        amount: p.amount,
        wasDoubleFee: p.wasDoubleFee,
        paidDate,
        dueDate,
        receiptNo: nextReceiptNo(),
        recordedById: p.recordedBy.id,
      },
    });
  }

  console.log("Seed complete.");
  console.log({
    settings: settingDefs.length,
    users: userDefs.length,
    members: memberDefs.length,
    dependents: dependentDefs.length,
    payments: paymentDefs.length,
    admin: admin.id,
  });
  console.log(
    `\nAll seeded users share the password: ${SEED_USER_PASSWORD}\n` +
      userDefs.map((u) => `  ${u.role.padEnd(11)} ${u.email}`).join("\n")
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
