import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const refreshTokenValue = req.cookies.get("refresh_token")?.value;

  if (refreshTokenValue) {
    await db.refreshToken
      .delete({ where: { token: refreshTokenValue } })
      .catch(() => {});
  }

  const res = NextResponse.json({ success: true });
  res.cookies.delete("access_token");
  res.cookies.delete("refresh_token");
  res.cookies.delete("user_info");
  return res;
}
