import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/middleware";
import { db } from "@/lib/db";

function jobFilter(user: { userId: string; teamId?: string; role: string }) {
  if (user.role === "super_admin") return {};
  return { teamId: user.teamId };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const job = await db.job.findFirst({
    where: { id: params.id, ...jobFilter(user) },
    include: { rows: { orderBy: { rowIndex: "asc" } } },
  });

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  return NextResponse.json({ job });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const job = await db.job.findFirst({
    where: { id: params.id, ...jobFilter(user) },
  });

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  await db.job.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
