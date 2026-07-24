import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { verifyAccessToken, AuthUser } from "./jwt";

/**
 * For use in server components / server actions — reads the access_token cookie
 * via next/headers.
 */
export async function getServerAuthUser(): Promise<AuthUser | null> {
  const cookieStore = cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) return null;
  try {
    return verifyAccessToken(token);
  } catch {
    return null;
  }
}

/**
 * For use in API route handlers — reads the access_token cookie from the
 * incoming NextRequest.
 */
export function getAuthUser(req: NextRequest): AuthUser | null {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return null;
  try {
    return verifyAccessToken(token);
  } catch {
    return null;
  }
}

/**
 * Asserts super_admin role. Returns the user if ok, null otherwise.
 */
export function requireSuperAdmin(user: AuthUser | null): user is AuthUser {
  return user?.role === "super_admin";
}
