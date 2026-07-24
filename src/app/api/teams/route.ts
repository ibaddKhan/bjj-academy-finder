import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/middleware";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.role === "super_admin") {
    // Super admin can see all teams
    const teams = await db.team.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    });
    return NextResponse.json({ teams });
  }

  // Regular users see only their teams
  const memberships = await db.teamMember.findMany({
    where: { userId: user.userId },
    include: { team: { select: { id: true, name: true, slug: true } } },
  });

  const teams = memberships.map((m) => m.team);
  return NextResponse.json({ teams });
}
