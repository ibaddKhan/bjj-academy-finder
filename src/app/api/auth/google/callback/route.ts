import { NextRequest, NextResponse } from "next/server";
import { decrypt, encrypt } from "@/lib/encrypt";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/settings?google=error&reason=missing_params", req.url)
    );
  }

  // Decrypt and validate state
  let stateData: { teamId: string; userId: string };
  try {
    stateData = JSON.parse(decrypt(state));
    if (!stateData.teamId || !stateData.userId) throw new Error("Invalid state");
  } catch {
    return NextResponse.redirect(
      new URL("/settings?google=error&reason=invalid_state", req.url)
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.APP_URL ?? req.nextUrl.origin;
  const redirectUri = `${appUrl}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/settings?google=error&reason=not_configured", req.url)
    );
  }

  // Exchange code for tokens
  let tokens: { refresh_token?: string; access_token?: string };
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("Google token exchange failed:", err);
      return NextResponse.redirect(
        new URL("/settings?google=error&reason=token_exchange", req.url)
      );
    }

    tokens = await tokenRes.json();
  } catch (err) {
    console.error("Google token exchange error:", err);
    return NextResponse.redirect(
      new URL("/settings?google=error&reason=token_exchange", req.url)
    );
  }

  if (!tokens.refresh_token) {
    return NextResponse.redirect(
      new URL("/settings?google=error&reason=no_refresh_token", req.url)
    );
  }

  // Get Google email for display
  let googleEmail = "Connected";
  try {
    const userInfoRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    if (userInfoRes.ok) {
      const userInfo = await userInfoRes.json();
      if (userInfo.email) googleEmail = userInfo.email;
    }
  } catch {
    // Non-critical — fall back to "Connected"
  }

  // Store encrypted refresh token and email in TeamSettings
  const { teamId } = stateData;

  await db.teamSettings.upsert({
    where: { teamId_key: { teamId, key: "googleOAuthRefreshToken" } },
    update: { value: encrypt(tokens.refresh_token) },
    create: { teamId, key: "googleOAuthRefreshToken", value: encrypt(tokens.refresh_token) },
  });

  await db.teamSettings.upsert({
    where: { teamId_key: { teamId, key: "googleOAuthEmail" } },
    update: { value: encrypt(googleEmail) },
    create: { teamId, key: "googleOAuthEmail", value: encrypt(googleEmail) },
  });

  return NextResponse.redirect(new URL("/settings?google=connected", req.url));
}
