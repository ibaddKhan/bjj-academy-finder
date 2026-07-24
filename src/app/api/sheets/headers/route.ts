import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/middleware";
import { getSheetHeaders } from "@/lib/sheets";

export async function GET(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!user.teamId) {
    return NextResponse.json({ error: "No active team" }, { status: 403 });
  }

  const sheetId = req.nextUrl.searchParams.get("sheetId");
  const tabName = req.nextUrl.searchParams.get("tabName");

  if (!sheetId || !tabName) {
    return NextResponse.json({ error: "Missing sheetId or tabName" }, { status: 400 });
  }

  try {
    const headers = await getSheetHeaders(user.teamId, sheetId, tabName);
    return NextResponse.json({ headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
