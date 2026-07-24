import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/middleware";
import { db } from "@/lib/db";

export async function DELETE(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user || !user.teamId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Remove OAuth tokens from TeamSettings
  await db.teamSettings.deleteMany({
    where: {
      teamId: user.teamId,
      key: { in: ["googleOAuthRefreshToken", "googleOAuthEmail"] },
    },
  });

  return NextResponse.json({ success: true });
}
