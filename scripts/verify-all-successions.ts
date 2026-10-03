import "dotenv/config";
import { prisma } from "../lib/prisma";

async function verifyAllSuccessions() {
  const pairs = [
    { pred: "HIS-0007", succ: "FIC-0007", dod: "2025-09" },
    { pred: "HIS-0002", succ: "FIC-0002", dod: "2024-04" },
    { pred: "HIS-0062", succ: "FIC-0062", dod: "2023-11" },
    { pred: "HIS-0142", succ: "FIC-0142", dod: "2025-12" },
    { pred: "HIS-0149", succ: "FIC-0149", dod: "2025-12" },
  ];

  console.log("=== 1. Checking Successor / Predecessor DOD Payment Split ===");
  let hasErrors = false;

  for (const pair of pairs) {
    const pred = await prisma.member.findUnique({
      where: { serialNo: pair.pred },
      include: { payments: { orderBy: { monthCovered: "asc" } } },
    });
    const succ = await prisma.member.findUnique({
      where: { serialNo: pair.succ },
      include: { payments: { orderBy: { monthCovered: "asc" } } },
    });

    const predMonths = new Set(pred?.payments.map(p => p.monthCovered.toISOString().slice(0, 7)));
    const succMonths = new Set(succ?.payments.map(p => p.monthCovered.toISOString().slice(0, 7)));

    // Check overlap
    const overlap: string[] = [];
    for (const m of predMonths) {
      if (succMonths.has(m)) overlap.push(m);
    }

    // Check pred payments after DOD
    const predAfterDOD = pred?.payments.filter(p => p.monthCovered.toISOString().slice(0, 7) > pair.dod) || [];
    // Check succ payments before or on DOD
    const succBeforeDOD = succ?.payments.filter(p => p.monthCovered.toISOString().slice(0, 7) <= pair.dod) || [];

    console.log(`\nPair ${pair.pred} & ${pair.succ} (DOD: ${pair.dod}):`);
    console.log(`  ${pair.pred} payments: ${pred?.payments.length} (From ${pred?.payments[0]?.monthCovered.toISOString().slice(0, 7)} to ${pred?.payments[pred.payments.length - 1]?.monthCovered.toISOString().slice(0, 7)})`);
    console.log(`  ${pair.succ} payments: ${succ?.payments.length} (From ${succ?.payments[0]?.monthCovered.toISOString().slice(0, 7)} to ${succ?.payments[succ.payments.length - 1]?.monthCovered.toISOString().slice(0, 7)})`);
    
    if (overlap.length > 0) {
      console.error(`  ❌ OVERLAP DETECTED:`, overlap);
      hasErrors = true;
    } else {
      console.log(`  ✔ Zero overlapping months.`);
    }

    if (predAfterDOD.length > 0) {
      console.error(`  ❌ Predecessor has payments after DOD:`, predAfterDOD.map(p => p.monthCovered.toISOString().slice(0, 7)));
      hasErrors = true;
    } else {
      console.log(`  ✔ Predecessor has 0 payments after DOD.`);
    }

    if (succBeforeDOD.length > 0) {
      console.error(`  ❌ Successor has payments on or before DOD:`, succBeforeDOD.map(p => p.monthCovered.toISOString().slice(0, 7)));
      hasErrors = true;
    } else {
      console.log(`  ✔ Successor has 0 payments before DOD.`);
    }
  }

  console.log("\n=== 2. Checking Global Duplicate Payments ===");
  const allPayments = await prisma.payment.findMany({
    select: { id: true, memberId: true, monthCovered: true },
  });
  const memberMonthMap = new Map<string, number>();
  let globalDups = 0;
  for (const p of allPayments) {
    const key = `${p.memberId}_${p.monthCovered.toISOString().slice(0, 7)}`;
    const count = (memberMonthMap.get(key) || 0) + 1;
    memberMonthMap.set(key, count);
    if (count > 1) globalDups++;
  }

  if (globalDups === 0) {
    console.log(`✔ All ${allPayments.length} payments have unique (memberId, monthCovered). Zero duplicates in database.`);
  } else {
    console.error(`❌ Found ${globalDups} duplicate payments.`);
    hasErrors = true;
  }

  if (!hasErrors) {
    console.log("\n🎉 ALL VERIFICATION CHECKS PASSED PERFECTLY!");
  }
}

verifyAllSuccessions().catch(console.error).finally(() => prisma.$disconnect());
