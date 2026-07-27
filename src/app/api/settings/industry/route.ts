import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/middleware";
import { db } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encrypt";
import {
  IndustryConfig,
  getIndustryPreset,
  DEFAULT_INDUSTRY_SLUG,
} from "@/lib/industries";

export async function GET(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!user.teamId) {
    return NextResponse.json({ config: getIndustryPreset(DEFAULT_INDUSTRY_SLUG) });
  }

  const row = await db.teamSettings.findUnique({
    where: { teamId_key: { teamId: user.teamId, key: "industryConfig" } },
  });

  if (!row) {
    return NextResponse.json({ config: getIndustryPreset(DEFAULT_INDUSTRY_SLUG) });
  }

  try {
    const config: IndustryConfig = JSON.parse(decrypt(row.value));
    return NextResponse.json({ config });
  } catch {
    return NextResponse.json({ config: getIndustryPreset(DEFAULT_INDUSTRY_SLUG) });
  }
}

export async function PUT(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!user.teamId) {
    return NextResponse.json({ error: "No active team" }, { status: 403 });
  }

  let body: IndustryConfig;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.slug || !body.label) {
    return NextResponse.json({ error: "slug and label are required" }, { status: 400 });
  }

  const value = encrypt(JSON.stringify(body));

  await db.teamSettings.upsert({
    where: { teamId_key: { teamId: user.teamId, key: "industryConfig" } },
    update: { value },
    create: { teamId: user.teamId, key: "industryConfig", value },
  });

  return NextResponse.json({ success: true });
}
