import { NextResponse } from "next/server";

import { AuthError, authErrorResponse, requireSession } from "@/lib/auth-guards";
import { EXPORT_ENTITIES, EXPORT_ROLES, type ExportEntity } from "@/lib/export-access";
import { hasRole } from "@/lib/rbac";
import { csvResponse, describeFilters, parseExportFilters } from "@/lib/exports/common";
import { TABLE_EXPORTS, type ExportDef } from "@/lib/exports/definitions";
import { buildStatement } from "@/lib/exports/statement";
import { renderTablePdf } from "@/lib/pdf/table-pdf";
import { renderStatementPdf } from "@/lib/pdf/statement-pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

/** CSV streams without limit; a PDF is laid out in memory, so it is capped. */
const MAX_PDF_ROWS = 5000;

type RouteParams = { params: Promise<{ entity: string }> };

function pdfResponse(pdf: Uint8Array, filename: string) {
  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function GET(request: Request, { params }: RouteParams) {
  let role;
  try {
    role = (await requireSession()).user.role;
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  const { entity } = await params;
  if (!(EXPORT_ENTITIES as readonly string[]).includes(entity)) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const key = entity as ExportEntity;
  if (!hasRole(role, EXPORT_ROLES[key])) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const search = new URL(request.url).searchParams;
  const format = search.get("format") === "pdf" ? "pdf" : "csv";
  const filters = parseExportFilters(search);

  if (key === "statement") {
    if (format !== "pdf") {
      return NextResponse.json({ error: "The period statement is only available as a PDF." }, { status: 400 });
    }
    const year = new Date().getUTCFullYear();
    const fromLabel = filters.fromLabel ?? `${year}-01-01`;
    const toLabel = filters.toLabel ?? `${year}-12-31`;
    const from = filters.from ?? new Date(`${fromLabel}T00:00:00.000Z`);
    const toExclusive = filters.toExclusive ?? new Date(new Date(`${toLabel}T00:00:00.000Z`).getTime() + 86_400_000);
    if (toExclusive <= from) {
      return NextResponse.json({ error: "The end date must be after the start date." }, { status: 400 });
    }
    const statement = await buildStatement(from, toExclusive, fromLabel, toLabel);
    return pdfResponse(await renderStatementPdf(statement), `statement-${fromLabel}-to-${toLabel}`);
  }

  const def = TABLE_EXPORTS[key] as unknown as ExportDef<Record<string, unknown>>;

  if (format === "csv") {
    async function* csvRows() {
      for await (const row of def.rows(filters)) yield def.columns.map((c) => c.value(row));
    }
    return csvResponse(def.filename, def.columns.map((c) => c.header), csvRows());
  }

  const rows: string[][] = [];
  const sums = def.columns.map(() => 0);
  for await (const row of def.rows(filters)) {
    if (rows.length >= MAX_PDF_ROWS) {
      return NextResponse.json(
        { error: `Too many records for a PDF (over ${MAX_PDF_ROWS}). Narrow the filters or use CSV.` },
        { status: 413 }
      );
    }
    rows.push(
      def.columns.map((c, i) => {
        const v = c.value(row);
        if (c.sum && typeof v === "number") sums[i] += v;
        return typeof v === "number" ? new Intl.NumberFormat("en-US").format(v) : v;
      })
    );
  }

  const hasSum = def.columns.some((c) => c.sum);
  const totals = hasSum
    ? def.columns.map((c, i) => (i === 0 ? "Total" : c.sum ? new Intl.NumberFormat("en-US").format(sums[i]) : ""))
    : undefined;

  const pdf = await renderTablePdf({
    title: def.title,
    filterLines: describeFilters(filters),
    columns: def.columns.map((c) => ({ header: c.header, flex: c.flex ?? 1, align: c.align ?? "left" })),
    rows,
    totals,
    landscape: def.landscape ?? false,
    generatedOn: new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Karachi" }).format(new Date()),
  });
  return pdfResponse(pdf, def.filename);
}
