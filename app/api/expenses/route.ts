import { NextResponse } from "next/server";

import { AuthError, authErrorResponse, requireRole, requireSession } from "@/lib/auth-guards";
import { expenseEntrySchema } from "@/lib/schemas/ledger";
import {
  countExpenses,
  createExpense,
  getExpenseTotal,
  listExpenseCategories,
  listExpenses,
} from "@/lib/ledgers";
import { pageCountOf, resolvePage, resolvePageSize } from "@/lib/pagination";

function parseFilters(searchParams: URLSearchParams) {
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const category = searchParams.get("category");
  return {
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    category: category ?? undefined,
  };
}

export async function GET(request: Request) {
  try {
    await requireSession();
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  const searchParams = new URL(request.url).searchParams;
  const filters = parseFilters(searchParams);
  const isAll = searchParams.get("all") === "true";

  if (isAll) {
    const [entries, total, categories, count] = await Promise.all([
      listExpenses(filters),
      getExpenseTotal(filters),
      listExpenseCategories(),
      countExpenses(filters),
    ]);
    return NextResponse.json({ entries, total, categories, count, page: 1, pageSize: count });
  }

  const pageSize = resolvePageSize(searchParams.get("pageSize") ?? undefined);
  const [count, total, categories] = await Promise.all([
    countExpenses(filters),
    getExpenseTotal(filters),
    listExpenseCategories(),
  ]);
  const page = resolvePage(searchParams.get("page") ?? undefined, pageCountOf(count, pageSize));
  const entries = await listExpenses({ ...filters, page, pageSize });

  return NextResponse.json({ entries, total, categories, count, page, pageSize });
}

export async function POST(request: Request) {
  let actorId: string;
  try {
    actorId = (await requireRole(["treasurer", "data_entry", "admin"])).user.id;
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = expenseEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const entry = await createExpense(parsed.data, actorId);
  return NextResponse.json({ entry }, { status: 201 });
}
