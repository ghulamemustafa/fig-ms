import { NextResponse } from "next/server";

import { AuthError, authErrorResponse, requireRole, requireSession } from "@/lib/auth-guards";
import { donationEntrySchema } from "@/lib/schemas/ledger";
import { createDonation, getDonationTotal, listDonations } from "@/lib/ledgers";

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

  const filters = parseDateRange(new URL(request.url).searchParams);
  const [entries, total] = await Promise.all([
    listDonations(filters),
    getDonationTotal(filters),
  ]);

  return NextResponse.json({ entries, total });
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
