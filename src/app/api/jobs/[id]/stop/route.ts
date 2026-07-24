import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/middleware";
import { db } from "@/lib/db";

function jobFilter(user: { userId: string; teamId?: string; role: string }) {
  if (user.role === "super_admin") return {};
  return { teamId: user.teamId };
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const job = await db.job.findFirst({
    where: { id: params.id, ...jobFilter(user) },
  });

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  if (job.status !== "running" && job.status !== "queued") {
    return NextResponse.json({ error: "Job is not running" }, { status: 400 });
  }

  await db.job.update({
    where: { id: params.id },
    data: { status: "paused" },
  });

  return NextResponse.json({ success: true });
}
