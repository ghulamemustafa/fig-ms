import "server-only";

export type ExportFilters = {
  from?: Date;
  /** Exclusive upper bound (the chosen end date + 1 day), so `to` is inclusive for the user. */
  toExclusive?: Date;
  fromLabel?: string;
  toLabel?: string;
  status?: string;
  memberId?: string;
  type?: string;
  category?: string;
};

const DAY = 86_400_000;

function parseDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function parseExportFilters(p: URLSearchParams): ExportFilters {
  const from = parseDate(p.get("from"));
  const to = parseDate(p.get("to"));
  return {
    from,
    toExclusive: to ? new Date(to.getTime() + DAY) : undefined,
    fromLabel: from ? p.get("from")! : undefined,
    toLabel: to ? p.get("to")! : undefined,
    status: p.get("status") || undefined,
    memberId: p.get("memberId") || undefined,
    type: p.get("type") || undefined,
    category: p.get("category") || undefined,
  };
}

export function dateRangeWhere(f: ExportFilters) {
  if (!f.from && !f.toExclusive) return undefined;
  return { ...(f.from ? { gte: f.from } : {}), ...(f.toExclusive ? { lt: f.toExclusive } : {}) };
}

export function describeFilters(f: ExportFilters): string[] {
  const out: string[] = [];
  if (f.fromLabel || f.toLabel) out.push(`Period: ${f.fromLabel ?? "start"} to ${f.toLabel ?? "today"}`);
  if (f.status) out.push(`Status: ${f.status}`);
  if (f.type) out.push(`Type: ${f.type}`);
  if (f.category) out.push(`Category: ${f.category}`);
  if (f.memberId) out.push("Single member");
  return out;
}

const BATCH = 500;

/** Keyset-paginates a query in batches so exports never hold the whole table at once. */
export async function* paged<T extends { id: string }>(
  fetchBatch: (cursor: string | undefined, take: number) => Promise<T[]>
): AsyncGenerator<T> {
  let cursor: string | undefined;
  for (;;) {
    const batch = await fetchBatch(cursor, BATCH);
    for (const row of batch) yield row;
    if (batch.length < BATCH) return;
    cursor = batch[batch.length - 1].id;
  }
}

export const isoDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
export const isoMonth = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 7) : "");

// --- CSV ---

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  // Guard against spreadsheet formula injection from user-entered text.
  if (typeof value === "string" && /^[=+@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Streams CSV (UTF-8 with BOM so Excel shows Urdu correctly) as rows are produced. */
export function csvResponse(
  filename: string,
  headers: string[],
  rows: AsyncIterable<unknown[]>
): Response {
  const encoder = new TextEncoder();
  const iterator = rows[Symbol.asyncIterator]();
  let sentHeader = false;

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!sentHeader) {
        sentHeader = true;
        controller.enqueue(encoder.encode("﻿" + headers.map(cell).join(",") + "\r\n"));
        return;
      }
      // Send a chunk of rows per pull to keep overhead low.
      let chunk = "";
      for (let i = 0; i < 200; i++) {
        const { value, done } = await iterator.next();
        if (done) {
          if (chunk) controller.enqueue(encoder.encode(chunk));
          controller.close();
          return;
        }
        chunk += value.map(cell).join(",") + "\r\n";
      }
      controller.enqueue(encoder.encode(chunk));
    },
    async cancel() {
      await iterator.return?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
