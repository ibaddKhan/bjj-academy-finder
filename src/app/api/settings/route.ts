import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encrypt";

const SETTINGS_KEYS = [
  "serperKey",
  "rapidapiKey",
  "openrouterKey",
  "zenrowsKey",
  "openrouterModel",
] as const;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db.settings.findMany({
    where: { userId: session.user.id },
  });

  const settings: Record<string, string> = {};
  for (const row of rows) {
    if (SETTINGS_KEYS.includes(row.key as (typeof SETTINGS_KEYS)[number])) {
      settings[row.key] = decrypt(row.value);
    }
  }

  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Array<{ userId: string; key: string; value: string }> = [];

  for (const key of SETTINGS_KEYS) {
    const value = body[key];
    if (value === undefined) continue;
    if (!value.trim()) continue;

    updates.push({
      userId: session.user.id,
      key,
      value: encrypt(value.trim()),
    });
  }

  for (const update of updates) {
    await db.settings.upsert({
      where: { userId_key: { userId: update.userId, key: update.key } },
      update: { value: update.value },
      create: update,
    });
  }

  return NextResponse.json({ success: true, updated: updates.length });
}
