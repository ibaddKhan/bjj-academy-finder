import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/middleware";
import { db } from "@/lib/db";
import { getQueue } from "@/lib/queue";
import { extractSheetId } from "@/lib/sheets";

export async function GET(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!user.teamId) {
    return NextResponse.json({ jobs: [] });
  }

  const jobs = await db.job.findMany({
    where: { teamId: user.teamId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      sheetUrl: true,
      tabName: true,
      templateSlug: true,
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
  const user = getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!user.teamId) {
    return NextResponse.json(
      { error: "No active team. Please ask an admin to add you to a team." },
      { status: 403 }
    );
  }

  let body: {
    sheetUrl: string;
    sheetId: string;
    tabId: string;
    tabName: string;
    columnMap: object;
    templateSlug?: string;
    destSheetId?: string;
    destTabName?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sheetUrl, sheetId, tabId, tabName, columnMap, templateSlug, destSheetId, destTabName } = body;

  if (!sheetUrl || !sheetId || !tabId || !tabName || !columnMap) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    extractSheetId(sheetUrl);
  } catch {
    return NextResponse.json({ error: "Invalid sheet URL" }, { status: 400 });
  }

  // Create the job in DB
  const job = await db.job.create({
    data: {
      teamId: user.teamId,
      createdById: user.userId,
      sheetUrl,
      sheetId,
      tabId,
      tabName,
      columnMap,
      templateSlug: templateSlug ?? null,
      destSheetId: destSheetId ?? null,
      destTabName: destTabName ?? null,
      status: "queued",
    },
  });

  // Enqueue in BullMQ
  const queue = getQueue();
  await queue.add(
    "process-job",
    { jobId: job.id, teamId: user.teamId },
    { jobId: job.id }
  );

  return NextResponse.json({ job }, { status: 201 });
}
