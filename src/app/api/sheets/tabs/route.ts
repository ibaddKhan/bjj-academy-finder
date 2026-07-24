import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/middleware";
import { extractSheetId, getSheetTabs } from "@/lib/sheets";

export async function GET(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!user.teamId) {
    return NextResponse.json({ error: "No active team" }, { status: 403 });
  }

  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    const sheetId = extractSheetId(url);
    const tabs = await getSheetTabs(user.teamId, sheetId);
    return NextResponse.json({ sheetId, tabs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
