import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/middleware";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user || !user.teamId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const members = await db.teamMember.findMany({
    where: { teamId: user.teamId },
    include: {
      user: { select: { id: true, name: true, username: true, role: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  return NextResponse.json({
    members: members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      username: m.user.username,
      role: m.user.role,
      joinedAt: m.joinedAt,
    })),
  });
}
