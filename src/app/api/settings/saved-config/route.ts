import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/middleware";
import { db } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encrypt";

const ALLOWED_KEYS = ["lastJobConfig", "lastEnrichmentConfig"] as const;
type ConfigKey = (typeof ALLOWED_KEYS)[number];

export async function GET(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user || !user.teamId) return NextResponse.json({ config: null });

  const key = req.nextUrl.searchParams.get("key");
  if (!key || !ALLOWED_KEYS.includes(key as ConfigKey)) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  const row = await db.teamSettings.findUnique({
    where: { teamId_key: { teamId: user.teamId, key } },
  });

  if (!row) return NextResponse.json({ config: null });

  try {
    const config = JSON.parse(decrypt(row.value));
    return NextResponse.json({ config });
  } catch {
    return NextResponse.json({ config: null });
  }
}

export async function PUT(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role === "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!user.teamId) return NextResponse.json({ error: "No active team" }, { status: 403 });

  let body: { key: string; value: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { key, value } = body;
  if (!key || !ALLOWED_KEYS.includes(key as ConfigKey)) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  const encrypted = encrypt(JSON.stringify(value));

  await db.teamSettings.upsert({
    where: { teamId_key: { teamId: user.teamId, key } },
    update: { value: encrypted },
    create: { teamId: user.teamId, key, value: encrypted },
  });

  return NextResponse.json({ success: true });
}
