import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-jwt-secret-change-in-production";

export interface AuthUser {
  userId: string;
  username: string;
  name: string;
  role: "super_admin" | "member";
  teamId?: string;
}

export function signAccessToken(payload: AuthUser): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
}

export function verifyAccessToken(token: string): AuthUser {
  const decoded = jwt.verify(token, JWT_SECRET) as AuthUser & {
    iat?: number;
    exp?: number;
  };
  return {
    userId: decoded.userId,
    username: decoded.username,
    name: decoded.name,
    role: decoded.role,
    teamId: decoded.teamId,
  };
}

export function generateRefreshToken(): string {
  return randomUUID();
}

export const REFRESH_TOKEN_EXPIRY_DAYS = 7;
export const ACCESS_TOKEN_EXPIRY_SECONDS = 15 * 60; // 15 minutes
