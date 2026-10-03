import "dotenv/config";
import ExcelJS from "exceljs";
import { prisma } from "../lib/prisma";
import { Prisma } from "../lib/generated/prisma/client";

// Ensure DATABASE_URL is available
if (!process.env.DATABASE_URL) {
  console.error("❌ ERROR: DATABASE_URL is not set in environment.");
  process.exit(1);
}

const isApply = process.argv.includes("--apply");

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function cleanPhone(val: any): string {
  if (!val) return "0000000000";
  const str = String(val).replace(/\D/g, "");
  if (str.length === 10 && str.startsWith("3")) return "0" + str;
  if (str.length === 11 && str.startsWith("03")) return str;
  return str.padStart(11, "0").slice(0, 11);
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function startOfMonthUTC(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex, 1));
}

function dueDateForMonth(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex, 15));
}

interface CalendarMonth {
  year: number;
  monthIndex: number; // 0-11
  key: string;        // "YYYY-MM"
  date: Date;
}

// Generate all calendar months from Sep 2022 to Dec 2026
const allCalendarMonths: CalendarMonth[] = [];
for (let m = 8; m <= 11; m++) {
  allCalendarMonths.push({
    year: 2022,
    monthIndex: m,
    key: `2022-${String(m + 1).padStart(2, "0")}`,
    date: startOfMonthUTC(2022, m),
  });
}
for (let y = 2023; y <= 2026; y++) {
  for (let m = 0; m <= 11; m++) {
    allCalendarMonths.push({
      year: y,
      monthIndex: m,
      key: `${y}-${String(m + 1).padStart(2, "0")}`,
      date: startOfMonthUTC(y, m),
    });
  }
}

async function main() {
  console.log("=========================================================");
  console.log("🚀 HISTORICAL DATA IMPORT & RECONCILIATION ENGINE");
  console.log(`Mode: ${isApply ? "🔴 APPLY (Will commit to PostgreSQL)" : "🟡 DRY RUN (Validation only)"}`);
  console.log("=========================================================\n");

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile("fig-accounts.xlsx");

  // Fetch admin user to attribute records
  const adminUser = await prisma.user.findFirst({
    where: { role: "admin" },
  });
  if (!adminUser) {
    throw new Error("No admin user found in database. Please run npm run db:bootstrap first.");
  }
  console.log(`Attributing system actions to Admin: ${adminUser.email} (${adminUser.id})\n`);

  // -------------------------------------------------------------
  // 1. EXTRACT 2026 MEMBERS WITH MASK (FIC-#### / HIS-####)
  // -------------------------------------------------------------
  console.log("--- Phase 1: Parsing Sheet 2026 Core Members with Masks ---");
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
    detectedFirstPaymentMonth?: Date;
    status: string;
    removedDate?: Date;
    removedReason?: string;
  }

  const membersBySerial = new Map<string, ParsedMember>();
  let lastAddress = "Ali pur";

  for (let r = 3; r <= ws2026.rowCount; r++) {
    const row = ws2026.getRow(r);
    const rawSer = row.getCell(1).value;
    const serVal = Number(rawSer);
    if (isNaN(serVal) || serVal <= 0) continue;

    const rawName = String(row.getCell(2).value || "").trim();
    if (!rawName) continue;
    const rawFather = String(row.getCell(3).value || "").trim();
    let rawAddress = String(row.getCell(4).value || "").trim();
    if (!rawAddress || rawAddress === '"' || rawAddress === '""') {
      rawAddress = lastAddress;
    } else {
      lastAddress = rawAddress;
    }
    const mobile = cleanPhone(row.getCell(5).value);

    let status = "active";
    let maritalStatus: "single" | "married" | "widowed" | "divorced" = "married";
    if (rawName.toLowerCase().includes("late")) {
      status = "deceased";
    }
    if (rawName.toLowerCase().includes("w/o") || rawName.toLowerCase().includes("bibi")) {
      maritalStatus = "widowed";
    }

    const prefix = status === "deceased" ? "HIS" : "FIC";
    const serialNo = `${prefix}-${String(serVal).padStart(4, "0")}`;
    const cnic = String(serVal).padStart(13, "0");

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
      originalJoinDate: new Date(Date.UTC(2026, 0, 1)), // backfilled in Phase 3
      currentJoinDate: new Date(Date.UTC(2026, 0, 1)),  // backfilled in Phase 3
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
      serialNo: "HIS-0002",
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
      serialNo: "HIS-0007",
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
      serialNo: "HIS-0062",
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
      serialNo: "HIS-0142",
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
      serialNo: "HIS-0149",
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
      serialNo: "HIS-0071",
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
      serialNo: "HIS-0014",
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
      serialNo: "HIS-0042",
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
      serialNo: "HIS-0046",
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

  // Build name resolution lookup for 2022-2023
  const nameToSerial = new Map<string, string>();
  membersBySerial.forEach((m, s) => {
    nameToSerial.set(normalize(m.name), s);
  });

  const historicalResolutions: Record<string, string> = {
    [normalize("Qari Asad Mehmood Kiani")]: "HIS-0002",
    [normalize("Muhammad Riaz Kiani")]: "HIS-0007",
    [normalize("Muhammad Akhtar Kiani")]: "HIS-0062",
    [normalize("Abdul Rehman (Pappu)")]: "HIS-0142",
    [normalize("Fazal Kareem")]: "HIS-0149",
    [normalize("Altaf Hussain Kiani")]: "HIS-0071",
    [normalize("Adnan Kiani")]: "HIS-0014",
    [normalize("Nasir Ali")]: "HIS-0042",
    [normalize("Basharat Ali")]: "HIS-0046",
  };

  /**
   * Resolves row to canonical serialNo.
   * Sheets 2024-2026 are evaluated by authoritative serial column FIRST.
   * Name lookup is strictly applied for 2022-2023, avoiding name collision on Ser 103!
   */
  function resolveMemberSerial(year: number, ser: number, rawName: string): string | undefined {
    if (year >= 2024) {
      if ((year === 2024 || year === 2025) && ser === 7) return "HIS-0007";
      if ((year === 2024 || year === 2025) && ser === 62) return "HIS-0062";
      if (year === 2025 && ser === 142) return "HIS-0142";
      if (year === 2025 && ser === 149) return "HIS-0149";
      const candFic = `FIC-${String(ser).padStart(4, "0")}`;
      const candHis = `HIS-${String(ser).padStart(4, "0")}`;
      if (membersBySerial.has(candFic)) return candFic;
      if (membersBySerial.has(candHis)) return candHis;
      return candFic;
    }

    // 2022 and 2023: Exact match only, NO fuzzy substring searching
    const norm = normalize(rawName);
    if (historicalResolutions[norm]) {
      return historicalResolutions[norm];
    }
    if (nameToSerial.has(norm)) {
      return nameToSerial.get(norm);
    }
    return undefined;
  }

  // -------------------------------------------------------------
  // 3. BACKFILL TRUE JOIN DATES (DETECTING MID-YEAR JOIN MONTHS)
  // -------------------------------------------------------------
  console.log("\n--- Phase 3: Backfilling True Join Dates ---");

  const scanYears = [
    { name: "2022", year: 2022, startM: 8, endM: 11, startCol: 6 },
    { name: "2023", year: 2023, startM: 0, endM: 11, startCol: 6 },
    { name: "2024", year: 2024, startM: 0, endM: 11, startCol: 6 },
    { name: "2025", year: 2025, startM: 0, endM: 11, startCol: 6 },
    { name: "2026", year: 2026, startM: 0, endM: 11, startCol: 6 },
  ];

  for (const sy of scanYears) {
    const ws = wb.getWorksheet(sy.name)!;
    for (let r = 3; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const ser = row.getCell(1).value;
      if (typeof ser !== "number") continue;
      const name = String(row.getCell(2).value || "").trim();
      const s = resolveMemberSerial(sy.year, ser, name);
      if (!s || !membersBySerial.has(s)) continue;

      const m = membersBySerial.get(s)!;

      // Find first non-zero payment month in this sheet
      for (let c = sy.startCol; c <= sy.startCol + (sy.endM - sy.startM); c++) {
        let val = row.getCell(c).value;
        if (val && typeof val === "object" && "result" in val) val = (val as any).result;
        if (Number(val) > 0) {
          const mIdx = sy.startM + (c - sy.startCol);
          const payDate = startOfMonthUTC(sy.year, mIdx);
          if (!m.detectedFirstPaymentMonth || payDate.getTime() < m.detectedFirstPaymentMonth.getTime()) {
            m.detectedFirstPaymentMonth = payDate;
          }
          break;
        }
      }
    }
  }

  // Set join dates from detected first payment month
  membersBySerial.forEach(m => {
    const firstPay = m.detectedFirstPaymentMonth || new Date(Date.UTC(2026, 0, 1));
    m.originalJoinDate = firstPay;
    m.currentJoinDate = firstPay;
  });

  // Successor join-date inheritance (for welfare fund eligibility):
  // Ser 2 (Ahsan Asad Kiani) inherits 2022-09-01 from Qari Asad
  const ser2 = membersBySerial.get("FIC-0002");
  if (ser2) {
    ser2.originalJoinDate = new Date(Date.UTC(2022, 8, 1));
  }
  // Ser 7 (Muhammad Fayyaz Kiani) inherits 2022-09-01 from Muhammad Riaz Kiani
  const ser7 = membersBySerial.get("FIC-0007");
  if (ser7) {
    ser7.originalJoinDate = new Date(Date.UTC(2022, 8, 1));
  }
  // Ser 62 (Saghira Bi Bi) inherits 2022-09-01 from Muhammad Akhtar Kiani
  const ser62 = membersBySerial.get("FIC-0062");
  if (ser62) {
    ser62.originalJoinDate = new Date(Date.UTC(2022, 8, 1));
  }
  // Ser 142 (Waheeda Bibi) inherits 2025-01-01 from Abdul Rehman
  const ser142 = membersBySerial.get("FIC-0142");
  if (ser142) {
    ser142.originalJoinDate = new Date(Date.UTC(2025, 0, 1));
  }
  // Ser 149 (Khuram Shahzad) inherits 2025-03-01 from Fazal Kareem
  const ser149 = membersBySerial.get("FIC-0149");
  if (ser149) {
    ser149.originalJoinDate = new Date(Date.UTC(2025, 2, 1));
  }

  const joinDist: Record<number, number> = {};
  membersBySerial.forEach(m => {
    const yr = m.originalJoinDate.getUTCFullYear();
    joinDist[yr] = (joinDist[yr] || 0) + 1;
  });
  console.log("✔ Join year distribution:", joinDist);

  // -------------------------------------------------------------
  // 4. PARSE INFLOWS & OUTFLOWS FROM 'ACCT' SHEET
  // -------------------------------------------------------------
  console.log("\n--- Phase 4: Extracting Inflows & Outflows from 'Acct' Sheet ---");
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
  // 5. PARSE PAYMENTS & MEMBER EXCESS CONTRIBUTIONS (UNIFIED LEDGER)
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

  // Pre-load sheet cell amounts per member: memberSerial -> Map<monthKey, amount>
  const memberMonthlyAmounts = new Map<string, Map<string, number>>();

  for (const yc of scanYears) {
    const ws = wb.getWorksheet(yc.name)!;
    for (let r = 3; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const ser = row.getCell(1).value;
      if (typeof ser !== "number") continue;
      const rawName = String(row.getCell(2).value || "").trim();

      const memberSerial = resolveMemberSerial(yc.year, ser, rawName);
      if (!memberSerial || !membersBySerial.has(memberSerial)) continue;

      if (!memberMonthlyAmounts.has(memberSerial)) {
        memberMonthlyAmounts.set(memberSerial, new Map());
      }
      const monthMap = memberMonthlyAmounts.get(memberSerial)!;

      for (let mIdx = yc.startM; mIdx <= yc.endM; mIdx++) {
        const colNum = yc.startCol + (mIdx - yc.startM);
        let cellVal = row.getCell(colNum).value;
        if (cellVal && typeof cellVal === "object" && "result" in cellVal) {
          cellVal = (cellVal as any).result;
        }
        const cellAmount = Number(cellVal) || 0;
        const key = `${yc.year}-${String(mIdx + 1).padStart(2, "0")}`;
        monthMap.set(key, cellAmount);
      }
    }
  }

  const paymentList: ParsedPayment[] = [];
  const memberDonations: MemberDonation[] = [];

  for (const [memberSerial, monthMap] of memberMonthlyAmounts.entries()) {
    const member = membersBySerial.get(memberSerial)!;

    // Filter all calendar months from member's currentJoinDate through Dec 2026
    const memberMonths = allCalendarMonths.filter(
      m => m.date.getTime() >= member.currentJoinDate.getTime()
    );

    // First 3 active months require 1,000 PKR / month (wasDoubleFee: true)
    // Only genuinely new joins pay 2x for first 3 months; successors / rejoins do not.
    const isNewJoin = member.originalJoinDate.getTime() === member.currentJoinDate.getTime();
    const first3MonthKeys = isNewJoin
      ? new Set(memberMonths.slice(0, 3).map(m => m.key))
      : new Set<string>();
    const paidMonths = new Set<string>();

    for (let i = 0; i < memberMonths.length; i++) {
      const m = memberMonths[i];
      const cellAmount = monthMap.get(m.key) || 0;
      if (cellAmount <= 0) continue;

      let remaining = cellAmount;
      const paidDate = dueDateForMonth(m.year, m.monthIndex);
      const receiptNo = `RCP-${m.year}-${String(m.monthIndex + 1).padStart(2, "0")}-${member.serialNo}`;

      // A. Condition 2: Clear past unpaid months (arrears) up to m
      for (let p = 0; p < i; p++) {
        const pastM = memberMonths[p];
        if (!paidMonths.has(pastM.key)) {
          const fee = first3MonthKeys.has(pastM.key) ? 1000 : 500;
          if (remaining >= fee) {
            paidMonths.add(pastM.key);
            paymentList.push({
              memberSerial,
              monthCovered: pastM.date,
              amount: fee,
              wasDoubleFee: fee === 1000,
              paidDate,
              dueDate: dueDateForMonth(pastM.year, pastM.monthIndex),
              receiptNo,
            });
            remaining -= fee;
          }
        }
      }

      // B. Cover current month m
      if (!paidMonths.has(m.key)) {
        const fee = first3MonthKeys.has(m.key) ? 1000 : 500;
        if (remaining >= fee) {
          paidMonths.add(m.key);
          paymentList.push({
            memberSerial,
            monthCovered: m.date,
            amount: fee,
            wasDoubleFee: fee === 1000,
            paidDate,
            dueDate: dueDateForMonth(m.year, m.monthIndex),
            receiptNo,
          });
          remaining -= fee;
        } else if (remaining > 0) {
          paidMonths.add(m.key);
          paymentList.push({
            memberSerial,
            monthCovered: m.date,
            amount: remaining,
            wasDoubleFee: false,
            paidDate,
            dueDate: dueDateForMonth(m.year, m.monthIndex),
            receiptNo,
          });
          remaining = 0;
        }
      }

      // C. Prepay future months ONLY IF they have 0 / blank in spreadsheet (e.g. Ser 186/187)
      if (remaining >= 500) {
        for (let f = i + 1; f < memberMonths.length; f++) {
          const futM = memberMonths[f];
          const futRaw = monthMap.get(futM.key) || 0;
          if (futRaw > 0) break; // Subsequent month has its own payment, do not roll forward

          if (!paidMonths.has(futM.key)) {
            const fee = first3MonthKeys.has(futM.key) ? 1000 : 500;
            if (remaining >= fee) {
              paidMonths.add(futM.key);
              paymentList.push({
                memberSerial,
                monthCovered: futM.date,
                amount: fee,
                wasDoubleFee: fee === 1000,
                paidDate,
                dueDate: dueDateForMonth(futM.year, futM.monthIndex),
                receiptNo,
              });
              remaining -= fee;
            } else {
              break;
            }
          }
          if (remaining < 500) break;
        }
      }

      // D. Any remaining excess is a Donation for month m
      if (remaining > 0) {
        memberDonations.push({
          memberSerial,
          donorName: member.name,
          donorContact: member.mobile,
          amount: remaining,
          date: paidDate,
          notes: `Voluntary excess contribution for ${MONTH_NAMES[m.monthIndex]} ${m.year}`,
        });
      }
    }
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

  function cellNum(cell: ExcelJS.Cell): number {
    let val = cell.value;
    if (val && typeof val === "object" && "result" in val) val = (val as any).result;
    return Number(val) || 0;
  }

  const years = [2022, 2023, 2024, 2025, 2026];
  for (let idx = 0; idx < years.length; idx++) {
    const yr = years[idx];
    const excelIn = cellNum(sRow2.getCell(idx + 2));
    const excelOut = cellNum(sRow3.getCell(idx + 2));
    const parsedIn = inflowByYear[yr];
    const parsedOut = outflowByYear[yr];

    console.log(`\n📅 Year ${yr}:`);
    console.log(`  Inflow:  Parsed ${parsedIn.toLocaleString()} PKR | Excel ${excelIn.toLocaleString()} PKR (Diff: ${(parsedIn - excelIn).toLocaleString()})`);
    console.log(`  Outflow: Parsed ${parsedOut.toLocaleString()} PKR | Excel ${excelOut.toLocaleString()} PKR (Diff: ${(parsedOut - excelOut).toLocaleString()})`);
  }

  const grandExcelIn = cellNum(sRow2.getCell(7));
  const grandExcelOut = cellNum(sRow3.getCell(7));
  const grandParsedIn = Object.values(inflowByYear).reduce((a, b) => a + b, 0);
  const grandParsedOut = Object.values(outflowByYear).reduce((a, b) => a + b, 0);

  console.log("\n---------------------------------------------------------");
  console.log(`🏁 GRAND TOTAL INFLOW:  Parsed ${grandParsedIn.toLocaleString()} PKR | Excel ${grandExcelIn.toLocaleString()} PKR`);
  console.log(`🏁 GRAND TOTAL OUTFLOW: Parsed ${grandParsedOut.toLocaleString()} PKR | Excel ${grandExcelOut.toLocaleString()} PKR`);
  console.log("---------------------------------------------------------");

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
    // 0. Clean reset of previous historical import records
    console.log("0/7 Cleaning previous imported transaction records...");
    await tx.payment.deleteMany({});
    await tx.donation.deleteMany({});
    await tx.fundPayout.deleteMany({});
    await tx.expense.deleteMany({});
    await tx.otherIncome.deleteMany({});
    await tx.dependent.deleteMany({});
    await tx.member.updateMany({ data: { succeededById: null } });
    await tx.member.deleteMany({});

    // 1. Members
    console.log("1/7 Writing members...");
    const serialToId = new Map<string, string>();

    for (const m of membersBySerial.values()) {
      const created = await tx.member.create({
        data: {
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
      });
      serialToId.set(m.serialNo, created.id);
    }

    // 2. Link Successions
    console.log("2/7 Linking successions...");
    if (serialToId.has("HIS-0002") && serialToId.has("FIC-0002")) {
      await tx.member.update({
        where: { serialNo: "HIS-0002" },
        data: { succeededById: serialToId.get("FIC-0002") },
      });
    }
    if (serialToId.has("HIS-0007") && serialToId.has("FIC-0007")) {
      await tx.member.update({
        where: { serialNo: "HIS-0007" },
        data: { succeededById: serialToId.get("FIC-0007") },
      });
    }
    if (serialToId.has("HIS-0062") && serialToId.has("FIC-0062")) {
      await tx.member.update({
        where: { serialNo: "HIS-0062" },
        data: { succeededById: serialToId.get("FIC-0062") },
      });
    }
    if (serialToId.has("HIS-0142") && serialToId.has("FIC-0142")) {
      await tx.member.update({
        where: { serialNo: "HIS-0142" },
        data: { succeededById: serialToId.get("FIC-0142") },
      });
    }
    if (serialToId.has("HIS-0149") && serialToId.has("FIC-0149")) {
      await tx.member.update({
        where: { serialNo: "HIS-0149" },
        data: { succeededById: serialToId.get("FIC-0149") },
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

      if (lower.includes("altaf hussain")) matchedMemberId = serialToId.get("HIS-0071");
      else if (lower.includes("qari asad")) matchedMemberId = serialToId.get("HIS-0002");
      else if (lower.includes("m riaz kiani") || lower.includes("m. riaz")) matchedMemberId = serialToId.get("HIS-0007");
      else if (lower.includes("akhtar kiani")) matchedMemberId = serialToId.get("HIS-0062");
      else {
        for (const [s, id] of serialToId.entries()) {
          const m = membersBySerial.get(s);
          if (m && lower.includes(m.name.toLowerCase())) {
            matchedMemberId = id;
            break;
          }
        }
      }

      if (!matchedMemberId) matchedMemberId = serialToId.get("FIC-0007")!;

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
    timeout: 180000,
  });

  console.log("\n🎉 Database migration finished successfully!");
}

main().catch(console.error);
