import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSheetHeaders } from "@/lib/sheets";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sheetId = req.nextUrl.searchParams.get("sheetId");
  const tabName = req.nextUrl.searchParams.get("tabName");

  if (!sheetId || !tabName) {
    return NextResponse.json(
      { error: "Missing sheetId or tabName" },
      { status: 400 }
    );
  }

  try {
    const headers = await getSheetHeaders(session.user.id, sheetId, tabName);
    return NextResponse.json({ headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
