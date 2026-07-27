import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/middleware";
import { encrypt } from "@/lib/encrypt";

export async function GET(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user || !user.teamId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID not configured" },
      { status: 500 }
    );
  }

  const appUrl = process.env.APP_URL ?? req.nextUrl.origin;
  const redirectUri = `${appUrl}/api/auth/google/callback`;

  // Encrypt state to prevent CSRF — contains teamId and userId
  let state: string;
  try {
    state = encrypt(JSON.stringify({ teamId: user.teamId, userId: user.userId }));
  } catch (err) {
    console.error("Google connect: encrypt failed:", err);
    return NextResponse.json(
      { error: "Server misconfiguration: ENCRYPTION_KEY not set or invalid" },
      { status: 500 }
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/spreadsheets email",
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}
