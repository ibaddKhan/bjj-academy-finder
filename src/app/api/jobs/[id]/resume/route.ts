import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getQueue } from "@/lib/queue";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const job = await db.job.findFirst({
    where: { id: params.id, userId: session.user.id },
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

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
    { jobId: params.id, userId: session.user.id, onlyFailed: false },
    { jobId: `${params.id}-resume-${Date.now()}` }
  );

  return NextResponse.json({ resumed: pendingCount });
}
