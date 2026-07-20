import { Worker, Job } from "bullmq";
import { db } from "@/lib/db";
import { getRedisConnection, JOB_QUEUE_NAME, JobPayload } from "@/lib/queue";
import {
  getUnprocessedRows,
  writeRowResult,
} from "@/lib/sheets";
import { runAgent, AgentSettings } from "@/lib/agent";
import { decrypt } from "@/lib/encrypt";
import { emitJobEvent } from "@/lib/events";

interface ColumnMap {
  nameCol: number;
  filterCol: number;
  filterValue: string;
  doneCol: number;
  doneValue: string;
  rowOffset?: number;
  rowLimit?: number;
  outputCols: {
    foundGym?: number;
    instagram?: number;
    facebook?: number;
    smoothcomp?: number;
    source?: number;
    reason?: number;
  };
}

async function getUserSettings(userId: string): Promise<AgentSettings> {
  const rows = await db.settings.findMany({ where: { userId } });
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = decrypt(row.value);
  }
  return {
    openrouterKey: map.openrouterKey ?? "",
    openrouterModel: map.openrouterModel ?? "anthropic/claude-haiku-4-5",
    serperKey: map.serperKey ?? "",
    rapidapiKey: map.rapidapiKey ?? "",
    zenrowsKey: map.zenrowsKey ?? "",
  };
}

async function processRow(
  jobRecord: {
    id: string;
    sheetId: string;
    tabName: string;
    columnMap: ColumnMap;
  },
  rowRecord: { id: string; rowIndex: number; rowData: string[] },
  userId: string,
  settings: AgentSettings
) {
  const { id: jobId, sheetId, tabName, columnMap } = jobRecord;
  const { id: rowId, rowIndex, rowData } = rowRecord;
  const attendeeName = rowData[columnMap.nameCol] ?? "";

  // Update row status to running
  await db.jobRow.update({
    where: { id: rowId },
    data: {
      status: "running",
      startedAt: new Date(),
      attempts: { increment: 1 },
    },
  });

  emitJobEvent({
    type: "row_start",
    jobId,
    rowId,
    rowIndex,
    attendeeName,
    timestamp: Date.now(),
  });

  try {
    const result = await runAgent(attendeeName, settings, jobId, rowId, rowIndex);

    // Build sheet updates
    const updates: { colIndex: number; value: string }[] = [];
    if (columnMap.outputCols.foundGym !== undefined && result.foundGym !== null) {
      updates.push({ colIndex: columnMap.outputCols.foundGym, value: result.foundGym });
    }
    if (columnMap.outputCols.instagram !== undefined && result.instagram !== null) {
      updates.push({ colIndex: columnMap.outputCols.instagram, value: result.instagram });
    }
    if (columnMap.outputCols.facebook !== undefined && result.facebook !== null) {
      updates.push({ colIndex: columnMap.outputCols.facebook, value: result.facebook });
    }
    if (columnMap.outputCols.smoothcomp !== undefined && result.smoothcomp !== null) {
      updates.push({ colIndex: columnMap.outputCols.smoothcomp, value: result.smoothcomp });
    }
    if (columnMap.outputCols.source !== undefined && result.source !== null) {
      updates.push({ colIndex: columnMap.outputCols.source, value: result.source });
    }
    if (columnMap.outputCols.reason !== undefined) {
      updates.push({ colIndex: columnMap.outputCols.reason, value: result.reason });
    }
    // Always write done value
    updates.push({ colIndex: columnMap.doneCol, value: columnMap.doneValue });

    // Write to sheet with retry
    let writeAttempts = 0;
    while (writeAttempts < 5) {
      try {
        await writeRowResult(userId, sheetId, tabName, rowIndex, updates);
        break;
      } catch (err) {
        writeAttempts++;
        if (writeAttempts >= 5) throw err;
        await sleep(2000 * writeAttempts);
      }
    }

    // Update DB
    await db.jobRow.update({
      where: { id: rowId },
      data: {
        status: "success",
        result: result as object,
        completedAt: new Date(),
        error: null,
      },
    });

    emitJobEvent({
      type: "row_complete",
      jobId,
      rowId,
      rowIndex,
      attendeeName,
      result,
      timestamp: Date.now(),
    });

    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    const updatedRow = await db.jobRow.update({
      where: { id: rowId },
      data: { error: errorMsg },
      select: { attempts: true },
    });

    emitJobEvent({
      type: "row_error",
      jobId,
      rowId,
      rowIndex,
      attendeeName,
      error: errorMsg,
      timestamp: Date.now(),
    });

    if (updatedRow.attempts >= 5) {
      await db.jobRow.update({
        where: { id: rowId },
        data: { status: "error", completedAt: new Date() },
      });
      return { success: false, final: true };
    }

    // Mark pending for retry
    await db.jobRow.update({
      where: { id: rowId },
      data: { status: "pending" },
    });

    return { success: false, final: false };
  }
}

async function processJob(bullJob: Job<JobPayload>) {
  const { jobId, userId, onlyFailed } = bullJob.data;

  // Load job from DB
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { rows: true },
  });

  if (!job) throw new Error(`Job ${jobId} not found`);

  await db.job.update({ where: { id: jobId }, data: { status: "running" } });

  const settings = await getUserSettings(userId);

  const columnMap = job.columnMap as unknown as ColumnMap;

  // Fetch rows from sheet if none in DB yet
  if (job.rows.length === 0 && !onlyFailed) {
    const sheetRows = await getUnprocessedRows(
      userId,
      job.sheetId,
      job.tabName,
      columnMap.filterCol,
      columnMap.filterValue,
      columnMap.rowOffset ?? 0,
      columnMap.rowLimit ?? 0
    );

    if (sheetRows.length > 0) {
      await db.jobRow.createMany({
        data: sheetRows.map((r) => ({
          jobId,
          rowIndex: r.rowIndex,
          rowData: r.rowData,
          status: "pending" as const,
        })),
      });

      await db.job.update({
        where: { id: jobId },
        data: { totalRows: sheetRows.length },
      });
    }
  }

  // Get rows to process
  const rows = await db.jobRow.findMany({
    where: { jobId, status: onlyFailed ? "pending" : "pending" },
    orderBy: { rowIndex: "asc" },
  });

  let doneRows = job.doneRows;
  let errorRows = job.errorRows;

  for (const row of rows) {
    const rowData = row.rowData as unknown as string[];

    let attempts = 0;
    let success = false;

    while (!success && attempts < 5) {
      const outcome = await processRow(
        {
          id: jobId,
          sheetId: job.sheetId,
          tabName: job.tabName,
          columnMap,
        },
        { id: row.id, rowIndex: row.rowIndex, rowData },
        userId,
        settings
      );

      if (outcome.success) {
        doneRows++;
        success = true;
      } else if (outcome.final) {
        errorRows++;
        break;
      } else {
        attempts++;
        await sleep(5000);
      }
    }

    // Update job progress
    await db.job.update({
      where: { id: jobId },
      data: { doneRows, errorRows },
    });

    emitJobEvent({
      type: "job_progress",
      jobId,
      doneRows,
      errorRows,
      totalRows: job.totalRows,
      timestamp: Date.now(),
    });

    // Configurable delay between rows
    await sleep(1000);
  }

  // Mark job complete
  await db.job.update({
    where: { id: jobId },
    data: { status: "completed", completedAt: new Date() },
  });

  emitJobEvent({
    type: "job_complete",
    jobId,
    doneRows,
    errorRows,
    totalRows: job.totalRows,
    timestamp: Date.now(),
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Worker singleton
const globalForWorker = globalThis as unknown as {
  bjjWorker: Worker | undefined;
};

export function startWorker() {
  if (globalForWorker.bjjWorker) return globalForWorker.bjjWorker;

  const worker = new Worker(JOB_QUEUE_NAME, processJob, {
    connection: getRedisConnection(),
    concurrency: 1,
  });

  worker.on("failed", async (job, err) => {
    if (job?.data?.jobId) {
      await db.job
        .update({
          where: { id: job.data.jobId },
          data: { status: "failed" },
        })
        .catch(console.error);

      emitJobEvent({
        type: "job_failed",
        jobId: job.data.jobId,
        error: err.message,
        timestamp: Date.now(),
      });
    }
    console.error("Worker job failed:", err);
  });

  worker.on("error", (err) => {
    console.error("Worker error:", err);
  });

  globalForWorker.bjjWorker = worker;
  console.log("BullMQ worker started");
  return worker;
}
