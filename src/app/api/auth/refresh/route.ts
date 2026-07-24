import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  signAccessToken,
  ACCESS_TOKEN_EXPIRY_SECONDS,
} from "@/lib/auth/jwt";

export async function GET(req: NextRequest) {
  const redirect = req.nextUrl.searchParams.get("redirect") ?? "/";
  return handleRefresh(req, redirect, "GET");
}

export async function POST(req: NextRequest) {
  return handleRefresh(req, null, "POST");
}

async function handleRefresh(
  req: NextRequest,
  redirectPath: string | null,
  method: string
) {
  const refreshTokenValue = req.cookies.get("refresh_token")?.value;

  if (!refreshTokenValue) {
    if (redirectPath) {
      const loginUrl = new URL("/login", req.url);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.json({ error: "No refresh token" }, { status: 401 });
  }

  // Validate refresh token in DB
  const stored = await db.refreshToken.findUnique({
    where: { token: refreshTokenValue },
    include: {
      user: { include: { teams: { include: { team: true }, take: 1 } } },
    },
  });

  if (!stored || stored.expiresAt < new Date()) {
    // Invalid or expired — delete if exists
    if (stored) {
      await db.refreshToken.delete({ where: { id: stored.id } }).catch(() => {});
    }
    if (redirectPath) {
      const loginUrl = new URL("/login", req.url);
      const res = NextResponse.redirect(loginUrl);
      res.cookies.delete("access_token");
      res.cookies.delete("refresh_token");
      res.cookies.delete("user_info");
      return res;
    }
    return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
  }

  const user = stored.user;
  const activeTeamId = user.teams[0]?.teamId ?? undefined;

  const newAccessToken = signAccessToken({
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    teamId: activeTeamId,
  });

  const secure = process.env.NODE_ENV === "production";

  if (redirectPath) {
    // Called from middleware redirect — issue new cookie and redirect to original page
    const target = new URL(redirectPath, req.url);
    const res = NextResponse.redirect(target);
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
        teamId: activeTeamId,
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

  // Called from client — return new access token in cookie + body
  const res = NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      teamId: activeTeamId,
    },
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
      teamId: activeTeamId,
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
