import { NextResponse } from "next/server";

import { AuthError, authErrorResponse, requireSession } from "@/lib/auth-guards";
import { listDefaulters } from "@/lib/payments";
import { resolvePageSize } from "@/lib/pagination";

export async function GET(request: Request) {
  try {
    await requireSession();
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  const { searchParams } = new URL(request.url);
  const pageSize = resolvePageSize(searchParams.get("pageSize") ?? undefined);
  const page = searchParams.get("page") ? Number(searchParams.get("page")) : 1;

  const result = await listDefaulters({ page, pageSize });

  return NextResponse.json(result);
}
