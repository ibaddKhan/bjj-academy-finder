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

  // Reset failed rows to pending
  const resetResult = await db.jobRow.updateMany({
    where: { jobId: params.id, status: "error" },
    data: {
      status: "pending",
      attempts: 0,
      error: null,
      result: undefined,
    },
  });

  if (resetResult.count === 0) {
    return NextResponse.json({ error: "No failed rows to retry" }, { status: 400 });
  }

  await db.job.update({
    where: { id: params.id },
    data: { status: "queued", errorRows: 0 },
  });

  const queue = getQueue();
  await queue.add(
    "process-job",
    { jobId: params.id, teamId: job.teamId, onlyFailed: true },
    { jobId: `${params.id}-retry-${Date.now()}` }
  );

  return NextResponse.json({ retrying: resetResult.count });
}
