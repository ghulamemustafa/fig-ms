import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { csvResponse, paged } from "@/lib/exports/common";
import { buildStatement } from "@/lib/exports/statement";
import { renderTablePdf } from "@/lib/pdf/table-pdf";

async function* rowsOf(rows: unknown[][]) {
  for (const r of rows) yield r;
}

describe("csvResponse", () => {
  it("adds a BOM, quotes special characters and neutralises formula injection", async () => {
    const res = csvResponse("x", ["a", "b"], rowsOf([["plain", 'has "quote", comma'], ["=SUM(A1)", "ریحانہ"], [-5, null]]));
    const bytes = new Uint8Array(await res.clone().arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM so Excel reads Urdu
    const text = await res.text();
    expect(text).toContain('plain,"has ""quote"", comma"');
    expect(text).toContain("'=SUM(A1),ریحانہ");
    expect(text).toContain("-5,"); // numbers are untouched
    expect(res.headers.get("Content-Disposition")).toContain("x.csv");
  });

  it("streams many rows without loading them all first", async () => {
    let produced = 0;
    async function* many() {
      for (let i = 0; i < 20000; i++) {
        produced++;
        yield [i, "row"];
      }
    }
    const res = csvResponse("big", ["n", "s"], many());
    const reader = res.body!.getReader();
    await reader.read(); // header
    await reader.read(); // first chunk of rows
    expect(produced).toBeLessThan(1000); // producer only advanced one chunk so far
    await reader.cancel();
  });
});

describe("paged", () => {
  it("walks every row across batch boundaries exactly once", async () => {
    const all = Array.from({ length: 1201 }, (_, i) => ({ id: String(i).padStart(5, "0") }));
    let calls = 0;
    const seen: string[] = [];
    for await (const row of paged(async (cursor, take) => {
      calls++;
      const start = cursor ? all.findIndex((r) => r.id === cursor) + 1 : 0;
      return all.slice(start, start + take);
    })) {
      seen.push(row.id);
    }
    expect(seen).toHaveLength(1201);
    expect(new Set(seen).size).toBe(1201);
    expect(calls).toBe(3);
  });
});

describe("PDF at scale", () => {
  it("lays out 3000 rows within a reasonable time", async () => {
    const rows = Array.from({ length: 3000 }, (_, i) => [`RC-${i}`, "2026-09-01", `FWC-${i}`, `Member ${i}`, "2026-09", "500", "No", "Tariq Treasurer"]);
    const start = performance.now();
    const pdf = await renderTablePdf({
      title: "Payments",
      filterLines: [],
      columns: rows[0].map((h) => ({ header: String(h).slice(0, 4), flex: 1, align: "left" as const })),
      rows,
      landscape: false,
      generatedOn: "today",
    });
    const seconds = (performance.now() - start) / 1000;
    console.log(`3000-row PDF: ${seconds.toFixed(1)}s, ${(pdf.length / 1024).toFixed(0)} KB`);
    expect(pdf.length).toBeGreaterThan(10_000);
    expect(seconds).toBeLessThan(45);
  }, 60_000);
});

describe("buildStatement", () => {
  const MARKER = "EXPORT-TEST-MARKER";
  afterAll(async () => {
    await prisma.otherIncome.deleteMany({ where: { source: MARKER } });
    await prisma.expense.deleteMany({ where: { category: MARKER } });
    await prisma.$disconnect();
  });

  it("totals a period, breaks expenses down by category and rolls opening -> closing", async () => {
    // Far-future year so real data never interferes.
    await prisma.otherIncome.create({ data: { date: new Date("2099-03-10T00:00:00Z"), source: MARKER, amount: 1000 } });
    await prisma.otherIncome.create({ data: { date: new Date("2099-03-11T00:00:00Z"), source: MARKER, amount: 500 } });
    await prisma.expense.create({ data: { date: new Date("2099-04-01T00:00:00Z"), category: MARKER, amount: 300 } });

    const st = await buildStatement(new Date("2099-01-01T00:00:00Z"), new Date("2100-01-01T00:00:00Z"), "2099-01-01", "2099-12-31");

    expect(st.income.otherIncome).toBe(1500);
    expect(st.income.total).toBe(1500);
    expect(st.outflow.expensesByCategory).toEqual([{ category: MARKER, amount: 300 }]);
    expect(st.net).toBe(1200);
    expect(st.closingBalance).toBe(st.openingBalance + 1200);
    expect(st.monthly).toHaveLength(12);
    expect(st.monthly[2]).toMatchObject({ month: "2099-03", income: 1500, outflow: 0 });
    expect(st.monthly[3]).toMatchObject({ month: "2099-04", income: 0, outflow: 300 });
  });
});
