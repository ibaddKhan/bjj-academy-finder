import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, requireSuperAdmin } from "@/lib/auth/middleware";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

export async function GET(req: NextRequest) {
  const user = getAuthUser(req);
  if (!requireSuperAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      createdAt: true,
      teams: { include: { team: { select: { id: true, name: true, slug: true } } } },
    },
  });

  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const user = getAuthUser(req);
  if (!requireSuperAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { username: string; password: string; name: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { username, password, name, role } = body;
  if (!username || !password || !name) {
    return NextResponse.json(
      { error: "username, password, and name are required" },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const validRole = role === "super_admin" ? "super_admin" : "member";
  const passwordHash = await hashPassword(password);

  try {
    const newUser = await db.user.create({
      data: {
        username: username.trim().toLowerCase(),
        passwordHash,
        name: name.trim(),
        role: validRole,
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ user: newUser }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Username already exists" }, { status: 409 });
  }
}

export async function PUT(req: NextRequest) {
  const user = getAuthUser(req);
  if (!requireSuperAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { id: string; password?: string; name?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, password, name, role } = body;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const updateData: Record<string, string> = {};
  if (name) updateData.name = name.trim();
  if (role && (role === "super_admin" || role === "member")) updateData.role = role;
  if (password) {
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    updateData.passwordHash = await hashPassword(password);
  }

  const updated = await db.user.update({
    where: { id },
    data: updateData,
    select: { id: true, username: true, name: true, role: true },
  });

  return NextResponse.json({ user: updated });
}
