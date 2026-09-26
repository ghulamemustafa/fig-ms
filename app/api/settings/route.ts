import { NextResponse } from "next/server";

import { AuthError, authErrorResponse, requireRole } from "@/lib/auth-guards";
import { updateSettingSchema } from "@/lib/schemas/settings";
import { getAllSettingsWithHistory, insertSettingVersion } from "@/lib/settings";

export async function GET() {
  try {
    await requireRole(["admin"]);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  const settings = await getAllSettingsWithHistory();
  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  let actorId: string;
  try {
    actorId = (await requireRole(["admin"])).user.id;
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSettingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { key, value, effectiveFrom } = parsed.data;

  try {
    await insertSettingVersion(key, value, effectiveFrom ?? new Date(), actorId);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update setting" },
      { status: 409 }
    );
  }

  const settings = await getAllSettingsWithHistory();
  return NextResponse.json({ settings });
}
