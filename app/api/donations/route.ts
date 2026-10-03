import { NextResponse } from "next/server";

import { AuthError, authErrorResponse, requireRole, requireSession } from "@/lib/auth-guards";
import { donationEntrySchema } from "@/lib/schemas/ledger";
import { countDonations, createDonation, getDonationTotal, listDonations } from "@/lib/ledgers";
import { pageCountOf, resolvePage, resolvePageSize } from "@/lib/pagination";

function parseDateRange(searchParams: URLSearchParams) {
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  return {
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
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
  const filters = parseDateRange(searchParams);
  const isAll = searchParams.get("all") === "true";

  if (isAll) {
    const [entries, total, count] = await Promise.all([
      listDonations(filters),
      getDonationTotal(filters),
      countDonations(filters),
    ]);
    return NextResponse.json({ entries, total, count, page: 1, pageSize: count });
  }

  const pageSize = resolvePageSize(searchParams.get("pageSize") ?? undefined);
  const [count, total] = await Promise.all([
    countDonations(filters),
    getDonationTotal(filters),
  ]);
  const page = resolvePage(searchParams.get("page") ?? undefined, pageCountOf(count, pageSize));
  const entries = await listDonations({ ...filters, page, pageSize });

  return NextResponse.json({ entries, total, count, page, pageSize });
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
  const parsed = donationEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const entry = await createDonation(parsed.data, actorId);
  return NextResponse.json({ entry }, { status: 201 });
}
