import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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

  if (job.status !== "running" && job.status !== "queued") {
    return NextResponse.json(
      { error: "Job is not running" },
      { status: 400 }
    );
  }

  await db.job.update({
    where: { id: params.id },
    data: { status: "paused" },
  });

  return NextResponse.json({ success: true });
}
