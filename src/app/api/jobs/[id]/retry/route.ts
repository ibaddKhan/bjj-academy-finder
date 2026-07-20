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
    return NextResponse.json(
      { error: "No failed rows to retry" },
      { status: 400 }
    );
  }

  // Reset job status
  await db.job.update({
    where: { id: params.id },
    data: {
      status: "queued",
      errorRows: 0,
    },
  });

  // Re-enqueue
  const queue = getQueue();
  await queue.add(
    "process-job",
    { jobId: params.id, userId: session.user.id, onlyFailed: true },
    { jobId: `${params.id}-retry-${Date.now()}` }
  );

  return NextResponse.json({ retrying: resetResult.count });
}
