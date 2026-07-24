import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/middleware";
import { db } from "@/lib/db";
import { getQueue } from "@/lib/queue";

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

  if (job.status !== "paused") {
    return NextResponse.json({ error: "Job is not paused" }, { status: 400 });
  }

  const pendingCount = await db.jobRow.count({
    where: { jobId: params.id, status: "pending" },
  });

  if (pendingCount === 0) {
    return NextResponse.json({ error: "No pending rows to resume" }, { status: 400 });
  }

  await db.job.update({
    where: { id: params.id },
    data: { status: "queued" },
  });

  const queue = getQueue();
  await queue.add(
    "process-job",
    { jobId: params.id, teamId: job.teamId, onlyFailed: false },
    { jobId: `${params.id}-resume-${Date.now()}` }
  );

  return NextResponse.json({ resumed: pendingCount });
}
