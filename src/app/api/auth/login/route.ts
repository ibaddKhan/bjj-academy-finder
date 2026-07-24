import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import {
  signAccessToken,
  generateRefreshToken,
  REFRESH_TOKEN_EXPIRY_DAYS,
  ACCESS_TOKEN_EXPIRY_SECONDS,
} from "@/lib/auth/jwt";

// Simple in-memory rate limiter: max 5 attempts per IP per minute
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count++;
  if (entry.count > 5) return true;
  return false;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again in a minute." },
      { status: 429 }
    );
  }

  let body: { username: string; password: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { username, password } = body;
  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password are required" },
      { status: 400 }
    );
  }

  // Look up user
  const user = await db.user.findUnique({
    where: { username: username.trim().toLowerCase() },
    include: { teams: { include: { team: true }, take: 1 } },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 }
    );
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 }
    );
  }

  // Determine active team (first team the user belongs to)
  const activeTeamId = user.teams[0]?.teamId ?? undefined;

  // Issue tokens
  const accessToken = signAccessToken({
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    teamId: activeTeamId,
  });

  const refreshTokenValue = generateRefreshToken();
  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  );

  await db.refreshToken.create({
    data: { token: refreshTokenValue, userId: user.id, expiresAt },
  });

  // Build response with cookies
  const res = NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      teamId: activeTeamId,
    },
  });

  const secure = process.env.NODE_ENV === "production";

  res.cookies.set("access_token", accessToken, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    maxAge: ACCESS_TOKEN_EXPIRY_SECONDS,
    path: "/",
  });

  res.cookies.set("refresh_token", refreshTokenValue, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
    path: "/",
  });

  // Non-httpOnly cookie for client-side display (name, role, teamId only — not security-sensitive)
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
