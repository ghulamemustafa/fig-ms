import "dotenv/config";
import path from "node:path";
import ExcelJS from "exceljs";
import { prisma } from "../lib/prisma";
import { Prisma } from "../lib/generated/prisma/client";

// Flags:
// npx tsx scripts/import-historical-data.ts          # Dry run by default
// npx tsx scripts/import-historical-data.ts --apply  # Commit to Postgres

const isApply = process.argv.includes("--apply");
const WORKBOOK_PATH = path.resolve(__dirname, "../fig-accounts.xlsx");

// Date helpers
function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function startOfMonthUTC(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex, 1));
}

function dueDateForMonth(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex, 15));
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanPhone(raw: any): string {
  if (!raw) return "0000000000";
  let s = String(raw).replace(/\D/g, "");
  if (s.length === 10) s = "0" + s;
  if (s.length < 10) return "0000000000";
  return s;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

async function main() {
  console.log("=========================================================");
  console.log(`🚀 FWCMS Complete Historical Migration Engine`);
  console.log(`Target: PostgreSQL via Prisma ORM`);
  console.log(`Execution Mode: ${isApply ? "💾 APPLY (Live Database Writes)" : "🔍 DRY RUN (Simulation Only)"}`);
  console.log("=========================================================\n");

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(WORKBOOK_PATH);

  const adminUser = await prisma.user.findFirst({ where: { role: "admin" } });
  if (!adminUser) {
    throw new Error("No admin user found in database. Please run npm run db:bootstrap first.");
  }
  console.log(`Attributing system actions to Admin: ${adminUser.email} (${adminUser.id})\n`);

  // -------------------------------------------------------------
  // 1. EXTRACT 2026 MEMBERS (CANONICAL 213 RECORDS)
  // -------------------------------------------------------------
  console.log("--- Phase 1: Parsing Sheet 2026 Core Members ---");
  const ws2026 = wb.getWorksheet("2026")!;

  interface ParsedMember {
    serialNo: string;
    ser: number;
    name: string;
    fatherName: string;
    address: string;
    mobile: string;
    cnic: string;
    dob: Date;
    maritalStatus: "single" | "married" | "widowed" | "divorced";
    occupation: string;
    income: number;
    originalJoinDate: Date;
    currentJoinDate: Date;
    status: string;
    removedDate?: Date;
    removedReason?: string;
  }

  const membersBySerial = new Map<string, ParsedMember>();
  let lastAddress = "Ali pur";

  for (let r = 3; r <= ws2026.rowCount; r++) {
    const row = ws2026.getRow(r);
    const serVal = row.getCell(1).value;
    if (typeof serVal !== "number") continue;

    const rawName = String(row.getCell(2).value || "").trim();
    const rawFather = String(row.getCell(3).value || "").trim();
    let rawAddress = String(row.getCell(4).value || "").trim();
    if (!rawAddress || rawAddress === '"' || rawAddress === '""') {
      rawAddress = lastAddress;
    } else {
      lastAddress = rawAddress;
    }
    const mobile = cleanPhone(row.getCell(5).value);
    const serialNo = String(serVal);
    const cnic = String(serVal).padStart(13, "0");

    let status = "active";
    let maritalStatus: "single" | "married" | "widowed" | "divorced" = "married";
    if (rawName.toLowerCase().includes("late")) {
      status = "deceased";
    }
    if (rawName.toLowerCase().includes("w/o") || rawName.toLowerCase().includes("bibi")) {
      maritalStatus = "widowed";
    }

    membersBySerial.set(serialNo, {
      serialNo,
      ser: serVal,
      name: rawName,
      fatherName: rawFather,
      address: rawAddress,
      mobile,
      cnic,
      dob: new Date(Date.UTC(1900, 0, 1)),
      maritalStatus,
      occupation: "Welfare Member",
      income: 0,
      originalJoinDate: new Date(Date.UTC(2026, 0, 1)), // backfilled below
      currentJoinDate: new Date(Date.UTC(2026, 0, 1)),  // backfilled below
      status,
    });
  }
  console.log(`✔ Parsed ${membersBySerial.size} core members from Sheet 2026.`);

  // -------------------------------------------------------------
  // 2. ADD HISTORICAL PREDECESSORS & FORMER MEMBERS
  // -------------------------------------------------------------
  console.log("\n--- Phase 2: Integrating Historical Predecessors & Deceased Members ---");
  const historicalMembers: ParsedMember[] = [
    // Predecessor of Ser 2 (Ahsan Asad Kiani)
    {
      serialNo: "HIST-002",
      ser: 7000,
      name: "Qari Asad Mehmood Kiani",
      fatherName: "M. Hanif",
      address: "Ali pur",
      mobile: "03155437654",
      cnic: "9000000000002",
      dob: new Date(Date.UTC(1900, 0, 1)),
      maritalStatus: "married",
      occupation: "Deceased Member",
      income: 0,
      originalJoinDate: new Date(Date.UTC(2022, 8, 1)),
      currentJoinDate: new Date(Date.UTC(2022, 8, 1)),
      status: "deceased",
      removedDate: new Date(Date.UTC(2024, 3, 7)),
      removedReason: "DOD 2024-04-07; succeeded by son Ahsan Asad Kiani",
    },
    // Predecessor of Ser 7 (Muhammad Fayyaz Kiani)
    {
      serialNo: "HIST-007",
      ser: 7001,
      name: "Muhammad Riaz Kiani",
      fatherName: "Mir Abdul",
      address: "Ali pur",
      mobile: "03110156140",
      cnic: "9000000000007",
      dob: new Date(Date.UTC(1900, 0, 1)),
      maritalStatus: "married",
      occupation: "Deceased Member",
      income: 0,
      originalJoinDate: new Date(Date.UTC(2022, 8, 1)),
      currentJoinDate: new Date(Date.UTC(2022, 8, 1)),
      status: "deceased",
      removedDate: new Date(Date.UTC(2025, 8, 19)),
      removedReason: "DOD 2025-09-19; succeeded by son Muhammad Fayyaz Kiani",
    },
    // Predecessor of Ser 62 (Saghira Bi Bi W/O)
    {
      serialNo: "HIST-062",
      ser: 7002,
      name: "Muhammad Akhtar Kiani",
      fatherName: "Habib Ullah",
      address: "Ali pur",
      mobile: "0000000000",
      cnic: "9000000000062",
      dob: new Date(Date.UTC(1900, 0, 1)),
      maritalStatus: "married",
      occupation: "Deceased Member",
      income: 0,
      originalJoinDate: new Date(Date.UTC(2022, 8, 1)),
      currentJoinDate: new Date(Date.UTC(2022, 8, 1)),
      status: "deceased",
      removedDate: new Date(Date.UTC(2023, 10, 2)),
      removedReason: "Deceased; succeeded by widow Saghira Bi Bi",
    },
    // Predecessor of Ser 142 (Waheeda Bibi)
    {
      serialNo: "HIST-142",
      ser: 7003,
      name: "Abdul Rehman (Pappu)",
      fatherName: "Muhammad Hussain",
      address: "Ali pur",
      mobile: "0000000000",
      cnic: "9000000000142",
      dob: new Date(Date.UTC(1900, 0, 1)),
      maritalStatus: "married",
      occupation: "Deceased Member",
      income: 0,
      originalJoinDate: new Date(Date.UTC(2025, 0, 1)),
      currentJoinDate: new Date(Date.UTC(2025, 0, 1)),
      status: "deceased",
      removedDate: new Date(Date.UTC(2025, 11, 31)),
      removedReason: "Deceased; succeeded by Waheeda Bibi",
    },
    // Predecessor of Ser 149 (Khuram Shahzad)
    {
      serialNo: "HIST-149",
      ser: 7004,
      name: "Fazal Kareem",
      fatherName: "Muhammad Ayub",
      address: "Ali pur",
      mobile: "0000000000",
      cnic: "9000000000149",
      dob: new Date(Date.UTC(1900, 0, 1)),
      maritalStatus: "married",
      occupation: "Former Member",
      income: 0,
      originalJoinDate: new Date(Date.UTC(2025, 0, 1)),
      currentJoinDate: new Date(Date.UTC(2025, 0, 1)),
      status: "removed",
      removedDate: new Date(Date.UTC(2025, 11, 31)),
      removedReason: "Discontinued; replaced by Khuram Shahzad",
    },
    // Altaf Hussain Kiani (died May 2023)
    {
      serialNo: "HIST-071",
      ser: 7005,
      name: "Altaf Hussain Kiani",
      fatherName: "Naik Muhammad",
      address: "Ali pur",
      mobile: "0000000000",
      cnic: "9000000000071",
      dob: new Date(Date.UTC(1900, 0, 1)),
      maritalStatus: "married",
      occupation: "Deceased Member",
      income: 0,
      originalJoinDate: new Date(Date.UTC(2022, 8, 1)),
      currentJoinDate: new Date(Date.UTC(2022, 8, 1)),
      status: "deceased",
      removedDate: new Date(Date.UTC(2023, 4, 22)),
      removedReason: "DOD 2023-05-22",
    },
    // Adnan Kiani (2022/2023 Ser 14)
    {
      serialNo: "HIST-014",
      ser: 7006,
      name: "Adnan Kiani",
      fatherName: "Abdul Rauf",
      address: "Ali pur",
      mobile: "0000000000",
      cnic: "9000000000014",
      dob: new Date(Date.UTC(1900, 0, 1)),
      maritalStatus: "married",
      occupation: "Former Member",
      income: 0,
      originalJoinDate: new Date(Date.UTC(2022, 8, 1)),
      currentJoinDate: new Date(Date.UTC(2022, 8, 1)),
      status: "removed",
      removedDate: new Date(Date.UTC(2023, 11, 31)),
      removedReason: "Discontinued membership at end of 2023",
    },
    // Nasir Ali (2022/2023 Ser 42)
    {
      serialNo: "HIST-042",
      ser: 7007,
      name: "Nasir Ali",
      fatherName: "Haji Zulfiqar Ali",
      address: "Ali pur",
      mobile: "0000000000",
      cnic: "9000000000042",
      dob: new Date(Date.UTC(1900, 0, 1)),
      maritalStatus: "married",
      occupation: "Former Member",
      income: 0,
      originalJoinDate: new Date(Date.UTC(2022, 8, 1)),
      currentJoinDate: new Date(Date.UTC(2022, 8, 1)),
      status: "removed",
      removedDate: new Date(Date.UTC(2023, 11, 31)),
      removedReason: "Discontinued membership at end of 2023",
    },
    // Basharat Ali (2022/2023 Ser 46)
    {
      serialNo: "HIST-046",
      ser: 7008,
      name: "Basharat Ali",
      fatherName: "Muhammad Afsar",
      address: "Ali pur",
      mobile: "0000000000",
      cnic: "9000000000046",
      dob: new Date(Date.UTC(1900, 0, 1)),
      maritalStatus: "married",
      occupation: "Former Member",
      income: 0,
      originalJoinDate: new Date(Date.UTC(2022, 8, 1)),
      currentJoinDate: new Date(Date.UTC(2022, 8, 1)),
      status: "removed",
      removedDate: new Date(Date.UTC(2023, 11, 31)),
      removedReason: "Discontinued membership at end of 2023",
    },
  ];

  historicalMembers.forEach(hm => membersBySerial.set(hm.serialNo, hm));
  console.log(`✔ Integrated ${historicalMembers.length} predecessors & former members (Total: ${membersBySerial.size}).`);

  // Build name resolution lookup
  const nameToSerial = new Map<string, string>();
  membersBySerial.forEach((m, s) => {
    nameToSerial.set(normalize(m.name), s);
  });

  // Explicit mappings for historical discrepancies:
  const historicalResolutions: Record<string, string> = {
    [normalize("Qari Asad Mehmood Kiani")]: "HIST-002",
    [normalize("Muhammad Riaz Kiani")]: "HIST-007",
    [normalize("Muhammad Akhtar Kiani")]: "HIST-062",
    [normalize("Abdul Rehman (Pappu)")]: "HIST-142",
    [normalize("Fazal Kareem")]: "HIST-149",
    [normalize("Altaf Hussain Kiani")]: "HIST-071",
    [normalize("Adnan Kiani")]: "HIST-014",
    [normalize("Nasir Ali")]: "HIST-042",
    [normalize("Basharat Ali")]: "HIST-046",
  };

  function resolveMemberSerial(year: number, ser: number, rawName: string): string | undefined {
    const norm = normalize(rawName);

    // Explicit overrides
    if (historicalResolutions[norm]) {
      return historicalResolutions[norm];
    }

    if (year >= 2024) {
      if ((year === 2024 || year === 2025) && ser === 7) return "HIST-007";
      if ((year === 2024 || year === 2025) && ser === 62) return "HIST-062";
      if (year === 2025 && ser === 142) return "HIST-142";
      if (year === 2025 && ser === 149) return "HIST-149";
      return String(ser);
    }

    // 2022 and 2023
    if (nameToSerial.has(norm)) {
      return nameToSerial.get(norm);
    }
    // Fuzzy search
    for (const [nameKey, serial] of nameToSerial.entries()) {
      if (nameKey.includes(norm) || norm.includes(nameKey)) {
        return serial;
      }
    }
    return undefined;
  }

  // -------------------------------------------------------------
  // 3. BACKFILL TRUE JOIN DATES
  // -------------------------------------------------------------
  console.log("\n--- Phase 3: Backfilling True Join Dates ---");

  // Scan 2022
  const ws2022 = wb.getWorksheet("2022")!;
  for (let r = 3; r <= ws2022.rowCount; r++) {
    const ser = ws2022.getRow(r).getCell(1).value;
    if (typeof ser !== "number") continue;
    const name = String(ws2022.getRow(r).getCell(2).value || "").trim();
    const s = resolveMemberSerial(2022, ser, name);
    if (s && membersBySerial.has(s)) {
      const m = membersBySerial.get(s)!;
      m.originalJoinDate = new Date(Date.UTC(2022, 8, 1));
      m.currentJoinDate = new Date(Date.UTC(2022, 8, 1));
    }
  }

  // Scan 2023
  const ws2023 = wb.getWorksheet("2023")!;
  for (let r = 3; r <= ws2023.rowCount; r++) {
    const ser = ws2023.getRow(r).getCell(1).value;
    if (typeof ser !== "number") continue;
    const name = String(ws2023.getRow(r).getCell(2).value || "").trim();
    const s = resolveMemberSerial(2023, ser, name);
    if (s && membersBySerial.has(s)) {
      const m = membersBySerial.get(s)!;
      if (m.originalJoinDate.getUTCFullYear() > 2023) {
        m.originalJoinDate = new Date(Date.UTC(2023, 0, 1));
        m.currentJoinDate = new Date(Date.UTC(2023, 0, 1));
      }
    }
  }

  // Scan 2024
  const ws2024 = wb.getWorksheet("2024")!;
  for (let r = 3; r <= ws2024.rowCount; r++) {
    const ser = ws2024.getRow(r).getCell(1).value;
    if (typeof ser !== "number") continue;
    const name = String(ws2024.getRow(r).getCell(2).value || "").trim();
    const s = resolveMemberSerial(2024, ser, name);
    if (s && membersBySerial.has(s)) {
      const m = membersBySerial.get(s)!;
      if (m.originalJoinDate.getUTCFullYear() > 2024) {
        m.originalJoinDate = new Date(Date.UTC(2024, 0, 1));
        m.currentJoinDate = new Date(Date.UTC(2024, 0, 1));
      }
    }
  }

  // Scan 2025
  const ws2025 = wb.getWorksheet("2025")!;
  for (let r = 3; r <= ws2025.rowCount; r++) {
    const ser = ws2025.getRow(r).getCell(1).value;
    if (typeof ser !== "number") continue;
    const name = String(ws2025.getRow(r).getCell(2).value || "").trim();
    const s = resolveMemberSerial(2025, ser, name);
    if (s && membersBySerial.has(s)) {
      const m = membersBySerial.get(s)!;
      if (m.originalJoinDate.getUTCFullYear() > 2025) {
        m.originalJoinDate = new Date(Date.UTC(2025, 0, 1));
        m.currentJoinDate = new Date(Date.UTC(2025, 0, 1));
      }
    }
  }

  // Successor join-date inheritance:
  // Ser 2 (Ahsan Asad Kiani) inherits 2022-09-01 from Qari Asad
  const ser2 = membersBySerial.get("2");
  if (ser2) {
    ser2.originalJoinDate = new Date(Date.UTC(2022, 8, 1));
    ser2.currentJoinDate = new Date(Date.UTC(2024, 3, 7));
  }
  // Ser 7 (Muhammad Fayyaz Kiani) inherits 2022-09-01 from Muhammad Riaz Kiani
  const ser7 = membersBySerial.get("7");
  if (ser7) {
    ser7.originalJoinDate = new Date(Date.UTC(2022, 8, 1));
    ser7.currentJoinDate = new Date(Date.UTC(2025, 8, 19));
  }
  // Ser 62 (Saghira Bi Bi) inherits 2022-09-01 from Muhammad Akhtar Kiani
  const ser62 = membersBySerial.get("62");
  if (ser62) {
    ser62.originalJoinDate = new Date(Date.UTC(2022, 8, 1));
    ser62.currentJoinDate = new Date(Date.UTC(2023, 10, 2));
  }
  // Ser 142 (Waheeda Bibi) inherits 2025-01-01 from Abdul Rehman
  const ser142 = membersBySerial.get("142");
  if (ser142) {
    ser142.originalJoinDate = new Date(Date.UTC(2025, 0, 1));
    ser142.currentJoinDate = new Date(Date.UTC(2026, 0, 1));
  }

  const joinDist: Record<number, number> = {};
  membersBySerial.forEach(m => {
    const yr = m.originalJoinDate.getUTCFullYear();
    joinDist[yr] = (joinDist[yr] || 0) + 1;
  });
  console.log("✔ Join year distribution:", joinDist);

  // -------------------------------------------------------------
  // 4. PARSE INFLOWS (BANK PROFIT & DONATIONS) FROM ACCT
  // -------------------------------------------------------------
  console.log("\n--- Phase 4: Extracting Inflows from 'Acct' Sheet ---");
  const wsAcct = wb.getWorksheet("Acct")!;

  interface ParsedIncome {
    date: Date;
    source: string;
    amount: number;
    description: string;
  }
  interface ParsedDonation {
    date: Date;
    donorName: string;
    amount: number;
    notes: string;
  }
  interface ParsedExpense {
    date: Date;
    category: string;
    amount: number;
    description: string;
  }
  interface ParsedPayout {
    date: Date;
    memberName: string;
    matchedSerial?: string;
    amount: number;
    reason: string;
    payoutType: "funeral" | "widow" | "other";
  }

  const incomeList: ParsedIncome[] = [];
  const dedicatedDonations: ParsedDonation[] = [];
  const expenseList: ParsedExpense[] = [];
  const payoutList: ParsedPayout[] = [];

  let lastAcctDate = new Date(Date.UTC(2022, 8, 30));

  for (let r = 3; r <= wsAcct.rowCount; r++) {
    const row = wsAcct.getRow(r);
    let dateVal = row.getCell(1).value;
    const desc = String(row.getCell(2).value || "").trim();
    const recVal = row.getCell(4).value;
    const expVal = row.getCell(6).value;

    if (!desc) continue;

    // Date resolution with ditto propagation
    if (dateVal instanceof Date) {
      lastAcctDate = dateVal;
    } else if (typeof dateVal === "string" && dateVal.trim() !== '"' && dateVal.trim() !== '""') {
      const parsed = new Date(dateVal);
      if (!isNaN(parsed.getTime())) lastAcctDate = parsed;
    }

    let yr = lastAcctDate.getUTCFullYear();
    if (yr === 1926) yr = 2026;
    const recordDate = new Date(Date.UTC(yr, lastAcctDate.getUTCMonth(), lastAcctDate.getUTCDate()));

    let rec = 0;
    if (typeof recVal === "number") rec = recVal;
    else if (recVal && typeof recVal === "object" && "result" in recVal) rec = Number((recVal as any).result) || 0;

    let exp = 0;
    if (typeof expVal === "number") exp = expVal;
    else if (expVal && typeof expVal === "object" && "result" in expVal) exp = Number((expVal as any).result) || 0;

    // Inflows
    if (rec > 0) {
      const lower = desc.toLowerCase();
      if (lower.startsWith("profit for the month")) {
        incomeList.push({
          date: recordDate,
          source: "Bank profit",
          amount: rec,
          description: desc,
        });
      } else if (!lower.startsWith("fund rec")) {
        // Any non-fund-received inflow is a community donation
        let donor = "General / Community Donor";
        if (lower.includes("razzaq kiani")) donor = "Razzaq Kiani of Gori Town";
        else if (lower.includes("javid kiani")) donor = "Javid Kiani of KRL";
        else if (lower.includes("haji javid kiani")) donor = "Haji Javid Kiani of Islamabad";

        dedicatedDonations.push({
          date: recordDate,
          donorName: donor,
          amount: rec,
          notes: desc,
        });
      }
    }

    // Outflows
    if (exp > 0) {
      const lower = desc.toLowerCase();
      if (lower.includes("ramzan pkg") || lower.includes("ramdan pkg")) {
        expenseList.push({
          date: recordDate,
          category: "Widow Support",
          amount: exp,
          description: desc,
        });
      } else if (lower.includes("register for records") || lower.includes("ream paper")) {
        expenseList.push({
          date: recordDate,
          category: "Stationery",
          amount: exp,
          description: desc,
        });
      } else if (lower.includes("banner")) {
        expenseList.push({
          date: recordDate,
          category: "Printing",
          amount: exp,
          description: desc,
        });
      } else if (lower.includes("chicken palo") || lower.includes("exp (chicken")) {
        expenseList.push({
          date: recordDate,
          category: "Events & Refreshments",
          amount: exp,
          description: desc,
        });
      } else if (lower.includes("atm") || lower.includes("tax") || lower.includes("debited by bank")) {
        expenseList.push({
          date: recordDate,
          category: "Bank Charges",
          amount: exp,
          description: desc,
        });
      } else {
        // Member-specific welfare disbursement
        let pType: "funeral" | "widow" | "other" = "funeral";
        if (lower.includes("marriage")) pType = "other";
        else if (lower.includes("medical")) pType = "other";

        payoutList.push({
          date: recordDate,
          memberName: desc,
          amount: exp,
          reason: desc,
          payoutType: pType,
        });
      }
    }
  }

  console.log(`✔ Extracted ${incomeList.length} Bank Profit records (Total: ${incomeList.reduce((s, i) => s + i.amount, 0).toLocaleString()} PKR).`);
  console.log(`✔ Extracted ${dedicatedDonations.length} Dedicated Community Donations (Total: ${dedicatedDonations.reduce((s, d) => s + d.amount, 0).toLocaleString()} PKR).`);
  console.log(`✔ Extracted ${expenseList.length} Operational Expenses (Total: ${expenseList.reduce((s, e) => s + e.amount, 0).toLocaleString()} PKR).`);
  console.log(`✔ Extracted ${payoutList.length} Member Welfare Disbursements (Total: ${payoutList.reduce((s, p) => s + p.amount, 0).toLocaleString()} PKR).`);

  // -------------------------------------------------------------
  // 5. PARSE PAYMENTS & MEMBER EXCESS CONTRIBUTIONS
  // -------------------------------------------------------------
  console.log("\n--- Phase 5: Processing Monthly Dues Matrix (2022-2026) ---");

  interface ParsedPayment {
    memberSerial: string;
    monthCovered: Date;
    amount: number;
    wasDoubleFee: boolean;
    paidDate: Date;
    dueDate: Date;
    receiptNo: string;
  }
  interface MemberDonation {
    memberSerial: string;
    donorName: string;
    donorContact: string;
    amount: number;
    date: Date;
    notes: string;
  }

  const paymentList: ParsedPayment[] = [];
  const memberDonations: MemberDonation[] = [];

  const yearConfigs = [
    { name: "2022", year: 2022, startMonth: 8, endMonth: 11, startCol: 6 }, // Sep-Dec
    { name: "2023", year: 2023, startMonth: 0, endMonth: 11, startCol: 6 }, // Jan-Dec
    { name: "2024", year: 2024, startMonth: 0, endMonth: 11, startCol: 6 }, // Jan-Dec
    { name: "2025", year: 2025, startMonth: 0, endMonth: 11, startCol: 6 }, // Jan-Dec
    { name: "2026", year: 2026, startMonth: 0, endMonth: 11, startCol: 6 }, // Jan-Dec
  ];

  for (const yc of yearConfigs) {
    const ws = wb.getWorksheet(yc.name)!;
    let yearMemberSum = 0;

    for (let r = 3; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const ser = row.getCell(1).value;
      if (typeof ser !== "number") continue;
      const rawName = String(row.getCell(2).value || "").trim();

      const memberSerial = resolveMemberSerial(yc.year, ser, rawName);
      if (!memberSerial || !membersBySerial.has(memberSerial)) {
        console.warn(`[WARN] Could not map member in ${yc.year} row ${r}: Ser ${ser} "${rawName}"`);
        continue;
      }
      const member = membersBySerial.get(memberSerial)!;

      for (let mIdx = yc.startMonth; mIdx <= yc.endMonth; mIdx++) {
        const colNum = yc.startCol + (mIdx - yc.startMonth);
        let cellVal = row.getCell(colNum).value;
        if (cellVal && typeof cellVal === "object" && "result" in cellVal) {
          cellVal = (cellVal as any).result;
        }
        const cellAmount = Number(cellVal) || 0;
        if (cellAmount <= 0) continue;

        yearMemberSum += cellAmount;
        const monthCovered = startOfMonthUTC(yc.year, mIdx);
        const dueDate = dueDateForMonth(yc.year, mIdx);
        const paidDate = dueDate;
        const receiptNo = `RCP-${yc.year}-${String(mIdx + 1).padStart(2, "0")}-${member.serialNo}`;

        const is2022Double = yc.year === 2022 && mIdx < 11;
        const requiredFee = is2022Double ? 1000 : 500;

        if (cellAmount >= requiredFee) {
          paymentList.push({
            memberSerial: member.serialNo,
            monthCovered,
            amount: requiredFee,
            wasDoubleFee: is2022Double,
            paidDate,
            dueDate,
            receiptNo,
          });

          const excess = cellAmount - requiredFee;
          if (excess > 0) {
            memberDonations.push({
              memberSerial: member.serialNo,
              donorName: member.name,
              donorContact: member.mobile,
              amount: excess,
              date: paidDate,
              notes: `Monthly excess dues contribution for ${MONTH_NAMES[mIdx]} ${yc.year} (Paid ${cellAmount}, Fee ${requiredFee})`,
            });
          }
        } else {
          paymentList.push({
            memberSerial: member.serialNo,
            monthCovered,
            amount: cellAmount,
            wasDoubleFee: false,
            paidDate,
            dueDate,
            receiptNo,
          });
        }
      }
    }
    console.log(`  ${yc.year}: Processed member collections totaling ${yearMemberSum.toLocaleString()} PKR.`);
  }

  console.log(`✔ Generated ${paymentList.length} monthly Payment records.`);
  console.log(`✔ Generated ${memberDonations.length} Member Excess Donations.`);

  // -------------------------------------------------------------
  // 6. TOTAL RECONCILIATIONS
  // -------------------------------------------------------------
  console.log("\n=========================================================");
  console.log("📊 RECONCILIATION SUMMARY");
  console.log("=========================================================");

  const summary = wb.getWorksheet("Summary")!;
  const sRow2 = summary.getRow(2); // Received
  const sRow3 = summary.getRow(3); // Expended

  const inflowByYear: Record<number, number> = { 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 0 };
  const outflowByYear: Record<number, number> = { 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 0 };

  paymentList.forEach(p => { inflowByYear[p.monthCovered.getUTCFullYear()] += p.amount; });
  incomeList.forEach(i => { inflowByYear[i.date.getUTCFullYear()] += i.amount; });
  dedicatedDonations.forEach(d => { inflowByYear[d.date.getUTCFullYear()] += d.amount; });
  memberDonations.forEach(d => { inflowByYear[d.date.getUTCFullYear()] += d.amount; });

  expenseList.forEach(e => { outflowByYear[e.date.getUTCFullYear()] += e.amount; });
  payoutList.forEach(p => { outflowByYear[p.date.getUTCFullYear()] += p.amount; });

  console.log("\nINFLOWS COMPARISON (Received):");
  for (let c = 2; c <= 6; c++) {
    const yr = 2020 + c;
    const excelVal = Number((sRow2.getCell(c).value as any)?.result || sRow2.getCell(c).value) || 0;
    const calcVal = inflowByYear[yr];
    const diff = calcVal - excelVal;
    console.log(`  ${yr}: Parsed=${calcVal.toLocaleString()} PKR | Excel=${excelVal.toLocaleString()} PKR | Diff=${diff}`);
  }

  console.log("\nOUTFLOWS COMPARISON (Expended):");
  for (let c = 2; c <= 6; c++) {
    const yr = 2020 + c;
    const excelVal = Number((sRow3.getCell(c).value as any)?.result || sRow3.getCell(c).value) || 0;
    const calcVal = outflowByYear[yr];
    console.log(`  ${yr}: Parsed=${calcVal.toLocaleString()} PKR | Excel=${excelVal.toLocaleString()} PKR`);
  }

  // -------------------------------------------------------------
  // 7. DATABASE WRITE (IF --apply)
  // -------------------------------------------------------------
  if (!isApply) {
    console.log("\n[DRY RUN COMPLETE] Zero database writes made. Run with --apply to commit to PostgreSQL.");
    return;
  }

  console.log("\n=========================================================");
  console.log("💾 COMMITTING TO POSTGRESQL (TRANSACTION)...");
  console.log("=========================================================");

  await prisma.$transaction(async (tx) => {
    // 1. Members
    console.log("1/7 Writing members...");
    const serialToId = new Map<string, string>();

    for (const m of membersBySerial.values()) {
      const created = await tx.member.upsert({
        where: { serialNo: m.serialNo },
        create: {
          serialNo: m.serialNo,
          name: m.name,
          fatherName: m.fatherName,
          cnic: m.cnic,
          mobile: m.mobile,
          address: m.address,
          maritalStatus: m.maritalStatus,
          occupation: m.occupation,
          income: new Prisma.Decimal(m.income),
          dob: m.dob,
          originalJoinDate: m.originalJoinDate,
          currentJoinDate: m.currentJoinDate,
          status: m.status,
          removedDate: m.removedDate,
          removedReason: m.removedReason,
        },
        update: {
          name: m.name,
          fatherName: m.fatherName,
          address: m.address,
          mobile: m.mobile,
          originalJoinDate: m.originalJoinDate,
          currentJoinDate: m.currentJoinDate,
          status: m.status,
          removedDate: m.removedDate,
          removedReason: m.removedReason,
        },
      });
      serialToId.set(m.serialNo, created.id);
    }

    // 2. Link Successions
    console.log("2/7 Linking successions...");
    if (serialToId.has("HIST-002") && serialToId.has("2")) {
      await tx.member.update({
        where: { serialNo: "HIST-002" },
        data: { succeededById: serialToId.get("2") },
      });
    }
    if (serialToId.has("HIST-007") && serialToId.has("7")) {
      await tx.member.update({
        where: { serialNo: "HIST-007" },
        data: { succeededById: serialToId.get("7") },
      });
    }
    if (serialToId.has("HIST-062") && serialToId.has("62")) {
      await tx.member.update({
        where: { serialNo: "HIST-062" },
        data: { succeededById: serialToId.get("62") },
      });
    }
    if (serialToId.has("HIST-142") && serialToId.has("142")) {
      await tx.member.update({
        where: { serialNo: "HIST-142" },
        data: { succeededById: serialToId.get("142") },
      });
    }

    // 3. Bank Profit
    console.log("3/7 Writing Bank Profit...");
    for (const inc of incomeList) {
      await tx.otherIncome.create({
        data: {
          date: inc.date,
          source: inc.source,
          amount: new Prisma.Decimal(inc.amount),
          description: inc.description,
        },
      });
    }

    // 4. Dedicated Donations & Member Donations
    console.log("4/7 Writing Donations...");
    for (const don of dedicatedDonations) {
      await tx.donation.create({
        data: {
          date: don.date,
          donorName: don.donorName,
          amount: new Prisma.Decimal(don.amount),
          notes: don.notes,
        },
      });
    }
    for (const md of memberDonations) {
      await tx.donation.create({
        data: {
          date: md.date,
          donorName: md.donorName,
          donorContact: md.donorContact,
          amount: new Prisma.Decimal(md.amount),
          notes: md.notes,
        },
      });
    }

    // 5. Expenses
    console.log("5/7 Writing Operational Expenses...");
    for (const exp of expenseList) {
      await tx.expense.create({
        data: {
          date: exp.date,
          category: exp.category,
          amount: new Prisma.Decimal(exp.amount),
          description: exp.description,
          approvedBy: "Executive Committee",
        },
      });
    }

    // 6. FundPayouts
    console.log("6/7 Writing Welfare Disbursements (FundPayout)...");
    for (const pay of payoutList) {
      let matchedMemberId: string | undefined;
      const lower = pay.memberName.toLowerCase();

      // Explicit pattern matches
      if (lower.includes("altaf hussain")) matchedMemberId = serialToId.get("HIST-071");
      else if (lower.includes("qari asad")) matchedMemberId = serialToId.get("HIST-002");
      else if (lower.includes("m riaz kiani") || lower.includes("m. riaz")) matchedMemberId = serialToId.get("HIST-007");
      else if (lower.includes("akhtar kiani")) matchedMemberId = serialToId.get("HIST-062");
      else {
        for (const [s, id] of serialToId.entries()) {
          const m = membersBySerial.get(s);
          if (m && lower.includes(m.name.toLowerCase())) {
            matchedMemberId = id;
            break;
          }
        }
      }

      // Default fallback if unlinked
      if (!matchedMemberId) matchedMemberId = serialToId.get("7")!;

      await tx.fundPayout.create({
        data: {
          memberId: matchedMemberId,
          payoutType: pay.payoutType,
          amount: new Prisma.Decimal(pay.amount),
          reason: pay.reason,
          status: "paid",
          paidDate: pay.date,
          requestedById: adminUser.id,
          autoApproved: true,
          createdAt: pay.date,
        },
      });
    }

    // 7. Payments in chunks
    console.log("7/7 Writing Payments...");
    const paymentRows = paymentList
      .filter(p => serialToId.has(p.memberSerial))
      .map(p => ({
        memberId: serialToId.get(p.memberSerial)!,
        monthCovered: p.monthCovered,
        amount: new Prisma.Decimal(p.amount),
        wasDoubleFee: p.wasDoubleFee,
        paidDate: p.paidDate,
        dueDate: p.dueDate,
        receiptNo: p.receiptNo,
        recordedById: adminUser.id,
      }));

    for (let i = 0; i < paymentRows.length; i += 500) {
      const chunk = paymentRows.slice(i, i + 500);
      await tx.payment.createMany({
        data: chunk,
        skipDuplicates: true,
      });
    }
  }, {
    timeout: 180000, // 3 minutes timeout for complete ingestion
  });

  console.log("\n🎉 Database migration finished successfully!");
}

main().catch(console.error);
