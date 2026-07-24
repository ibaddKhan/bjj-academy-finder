import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, requireSuperAdmin } from "@/lib/auth/middleware";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = getAuthUser(req);
  if (!requireSuperAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const teams = await db.team.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { members: true, jobs: true } } },
  });

  return NextResponse.json({ teams });
}

export async function POST(req: NextRequest) {
  const user = getAuthUser(req);
  if (!requireSuperAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { name: string; slug: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, slug } = body;
  if (!name || !slug) {
    return NextResponse.json({ error: "name and slug are required" }, { status: 400 });
  }

  const slugClean = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  try {
    const team = await db.team.create({ data: { name, slug: slugClean } });
    return NextResponse.json({ team }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
  }
}
