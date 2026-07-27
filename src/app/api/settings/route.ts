import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/middleware";
import { db } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encrypt";

const SETTINGS_KEYS = [
  "serperKey",
  "instagramKey",
  "facebookKey",
  "openrouterKey",
  "zenrowsKey",
  "openrouterModel",
  "scrapingantKey",
  "enrichmentModel1",
  "enrichmentModel2",
] as const;

type SettingsKey = (typeof SETTINGS_KEYS)[number];

// Keys that should be masked/not fully revealed
const MASKED_KEYS: SettingsKey[] = [
  "serperKey",
  "instagramKey",
  "facebookKey",
  "openrouterKey",
  "zenrowsKey",
  "scrapingantKey",
];

// Keys returned as plain (model names)
const PLAIN_KEYS: SettingsKey[] = ["openrouterModel", "enrichmentModel1", "enrichmentModel2"];

export async function GET(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!user.teamId) {
    return NextResponse.json({ settings: {} });
  }

  const rows = await db.teamSettings.findMany({
    where: { teamId: user.teamId },
  });

  const settings: Record<string, string> = {};
  for (const row of rows) {
    if (row.key === "googleOAuthEmail") {
      settings.googleOAuthEmail = decrypt(row.value);
      continue;
    }

    if (!SETTINGS_KEYS.includes(row.key as SettingsKey)) continue;
    const key = row.key as SettingsKey;

    if (PLAIN_KEYS.includes(key)) {
      settings[key] = decrypt(row.value);
    } else if (MASKED_KEYS.includes(key)) {
      const decrypted = decrypt(row.value);
      settings[key] = decrypted
        ? decrypted.slice(0, 4) + "••••••••" + decrypted.slice(-4)
        : "";
    }
  }

  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.role === "super_admin") {
    return NextResponse.json({ error: "Super admins do not have team settings" }, { status: 403 });
  }

  if (!user.teamId) {
    return NextResponse.json({ error: "No active team" }, { status: 403 });
  }

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Array<{ teamId: string; key: string; value: string }> = [];

  for (const key of SETTINGS_KEYS) {
    const value = body[key];
    if (value === undefined || value === null) continue;
    if (!value.trim()) continue;

    // Don't re-encrypt if the value looks like a masked value (•••)
    if (value.includes("••••••••")) continue;

    updates.push({
      teamId: user.teamId,
      key,
      value: encrypt(value.trim()),
    });
  }

  for (const update of updates) {
    await db.teamSettings.upsert({
      where: { teamId_key: { teamId: update.teamId, key: update.key } },
      update: { value: update.value },
      create: update,
    });
  }

  return NextResponse.json({ success: true, updated: updates.length });
}
