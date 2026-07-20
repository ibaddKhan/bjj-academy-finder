import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { extractSheetId, getSheetTabs } from "@/lib/sheets";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    const sheetId = extractSheetId(url);
    const tabs = await getSheetTabs(session.user.id, sheetId);
    return NextResponse.json({ sheetId, tabs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
