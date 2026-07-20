import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getQueue } from "@/lib/queue";
import { extractSheetId } from "@/lib/sheets";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobs = await db.job.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      sheetUrl: true,
      tabName: true,
      status: true,
      totalRows: true,
      doneRows: true,
      errorRows: true,
      createdAt: true,
      completedAt: true,
    },
  });

  return NextResponse.json({ jobs });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    sheetUrl: string;
    sheetId: string;
    tabId: string;
    tabName: string;
    columnMap: object;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sheetUrl, sheetId, tabId, tabName, columnMap } = body;

  if (!sheetUrl || !sheetId || !tabId || !tabName || !columnMap) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Verify the sheet URL is valid
  try {
    extractSheetId(sheetUrl);
  } catch {
    return NextResponse.json({ error: "Invalid sheet URL" }, { status: 400 });
  }

  // Create the job in DB
  const job = await db.job.create({
    data: {
      userId: session.user.id,
      sheetUrl,
      sheetId,
      tabId,
      tabName,
      columnMap,
      status: "queued",
    },
  });

  // Enqueue in BullMQ
  const queue = getQueue();
  await queue.add(
    "process-job",
    { jobId: job.id, userId: session.user.id },
    { jobId: job.id }
  );

  return NextResponse.json({ job }, { status: 201 });
}
