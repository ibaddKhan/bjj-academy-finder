import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, requireSuperAdmin } from "@/lib/auth/middleware";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = getAuthUser(req);
  if (!requireSuperAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { userId: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId } = body;
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    const member = await db.teamMember.create({
      data: { teamId: params.id, userId },
      include: { user: true },
    });
    return NextResponse.json({ member }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "User is already a member or not found" }, { status: 409 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = getAuthUser(req);
  if (!requireSuperAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  await db.teamMember.deleteMany({
    where: { teamId: params.id, userId },
  });

  return NextResponse.json({ success: true });
}
