import { NextResponse } from "next/server";

import { AuthError, authErrorResponse, requireRole, requireSession } from "@/lib/auth-guards";
import { expenseEntrySchema } from "@/lib/schemas/ledger";
import {
  createExpense,
  getExpenseTotal,
  listExpenseCategories,
  listExpenses,
} from "@/lib/ledgers";

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

  const filters = parseFilters(new URL(request.url).searchParams);
  const [entries, total, categories] = await Promise.all([
    listExpenses(filters),
    getExpenseTotal(filters),
    listExpenseCategories(),
  ]);

  return NextResponse.json({ entries, total, categories });
}

export async function POST(request: Request) {
  try {
    await requireRole(["treasurer", "data_entry", "admin"]);
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

  const entry = await createExpense(parsed.data);
  return NextResponse.json({ entry }, { status: 201 });
}
