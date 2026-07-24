import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/middleware";
import { signAccessToken, ACCESS_TOKEN_EXPIRY_SECONDS } from "@/lib/auth/jwt";

export async function POST(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { teamId: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { teamId } = body;
  if (!teamId) {
    return NextResponse.json({ error: "teamId is required" }, { status: 400 });
  }

  // Super admin can switch to any team
  if (user.role !== "super_admin") {
    const membership = await db.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: user.userId } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Not a member of this team" }, { status: 403 });
    }
  }

  const newAccessToken = signAccessToken({
    userId: user.userId,
    username: user.username,
    name: user.name,
    role: user.role,
    teamId,
  });

  const secure = process.env.NODE_ENV === "production";

  const res = NextResponse.json({
    user: { ...user, teamId },
  });

  res.cookies.set("access_token", newAccessToken, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    maxAge: ACCESS_TOKEN_EXPIRY_SECONDS,
    path: "/",
  });

  res.cookies.set(
    "user_info",
    JSON.stringify({
      name: user.name,
      username: user.username,
      role: user.role,
      teamId,
    }),
    {
      httpOnly: false,
      secure,
      sameSite: "strict",
      maxAge: ACCESS_TOKEN_EXPIRY_SECONDS,
      path: "/",
    }
  );

  return res;
}
