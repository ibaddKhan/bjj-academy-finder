import { Worker, Job } from "bullmq";
import { db } from "@/lib/db";
import { getRedisConnection, JOB_QUEUE_NAME, JobPayload } from "@/lib/queue";
import { getUnprocessedRows, writeRowResult, appendRow } from "@/lib/sheets";
import { runAgent, AgentSettings } from "@/lib/agent";
import { decrypt } from "@/lib/encrypt";
import { emitJobEvent } from "@/lib/events";
import { getTemplate, PipelineTemplate, TemplateResult, TemplateSettings } from "@/lib/templates/registry";

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

interface EnrichmentColumnMap {
  inputCols: Record<string, number>;
  filterCol: number;
  filterValue: string;
  doneCol: number;
  doneValue: string;
  rowOffset?: number;
  rowLimit?: number;
  sourceOutputCols: Record<string, number>;
  destOutputCols: Record<string, number>;
}

// Load and decrypt all settings for a team in one DB query
async function loadSettingsMap(teamId: string): Promise<Record<string, string>> {
  const rows = await db.teamSettings.findMany({ where: { teamId } });
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = decrypt(row.value);
  }
  return map;
}

function buildAgentSettings(map: Record<string, string>): AgentSettings {
  return {
    openrouterKey: map.openrouterKey ?? "",
    openrouterModel: map.openrouterModel ?? "anthropic/claude-haiku-4-5",
    serperKey: map.serperKey ?? "",
    instagramKey: map.instagramKey ?? "",
    facebookKey: map.facebookKey ?? "",
    zenrowsKey: map.zenrowsKey ?? "",
  };
}

function buildTemplateSettings(map: Record<string, string>): TemplateSettings {
  return {
    openrouterKey: map.openrouterKey ?? "",
    enrichmentModel1: map.enrichmentModel1 ?? "anthropic/claude-haiku-4-5",
    enrichmentModel2: map.enrichmentModel2 ?? "anthropic/claude-haiku-4-5",
    serperKey: map.serperKey ?? "",
    facebookKey: map.facebookKey ?? "",
    zenrowsKey: map.zenrowsKey ?? "",
    scrapingantKey: map.scrapingantKey ?? "",
  };
}

// ─── Enrichment DB helpers ────────────────────────────────────────────────────

function parseSocialMedia(socialMedia: string | null | undefined): {
  facebook: string | null;
  instagram: string | null;
} {
  if (!socialMedia) return { facebook: null, instagram: null };
  const urls = socialMedia.split(/[\s,|;]+/).map((s) => s.trim()).filter(Boolean);
  let facebook: string | null = null;
  let instagram: string | null = null;
  for (const url of urls) {
    if (!facebook && /facebook\.com/i.test(url)) facebook = url;
    if (!instagram && /instagram\.com/i.test(url)) instagram = url;
  }
  return { facebook, instagram };
}

function parseLocations(locations: string | null | undefined): {
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
} {
  if (!locations) return { address: null, city: null, state: null, country: null };
  const address = locations.trim() || null;
  const parts = locations.split(",").map((s) => s.trim()).filter(Boolean);
  let city: string | null = null;
  let state: string | null = null;
  let country: string | null = null;
  if (parts.length === 1) {
    city = parts[0];
  } else if (parts.length === 2) {
    city = parts[0];
    state = parts[1];
  } else if (parts.length >= 3) {
    city = parts[0];
    state = parts[1];
    country = parts[parts.length - 1];
  }
  return { address, city, state, country };
}

async function upsertEventEnrichment(gymName: string, result: TemplateResult) {
  if (!result.data) return;
  const d = result.data;
  const { facebook, instagram } = parseSocialMedia(d.social_media as string | null);
  const locationParsed = parseLocations(d.locations as string | null);

  const payload = {
    name: (d.name as string | null) ?? null,
    email: (d.email as string | null) ?? null,
    phone: (d.phone as string | null) ?? null,
    ...locationParsed,
    gym_academy_url: (d.website as string | null) ?? null,
    facebook,
    instagram,
    owner_person_in_charge: (d.owners as string | null) ?? null,
    source: "AI Agent Tool",
    owner_instagram: (d.owner_instagram as string | null) ?? null,
    coaches: (d.coaches as string | null) ?? null,
  };

  const existing = await db.eventEnrichment.findFirst({
    where: { name_id: gymName },
    select: { id: true },
  });

  if (existing) {
    await db.eventEnrichment.update({ where: { id: existing.id }, data: payload });
  } else {
    await db.eventEnrichment.create({ data: { name_id: gymName, ...payload } });
  }
}

// ─── Person Finder row processor ──────────────────────────────────────────────

async function processRow(
  jobRecord: {
    id: string;
    sheetId: string;
    tabName: string;
    columnMap: ColumnMap;
  },
  rowRecord: { id: string; rowIndex: number; rowData: string[] },
  teamId: string,
  settings: AgentSettings
) {
  const { id: jobId, sheetId, tabName, columnMap } = jobRecord;
  const { id: rowId, rowIndex, rowData } = rowRecord;
  const attendeeName = rowData[columnMap.nameCol] ?? "";

  await db.jobRow.update({
    where: { id: rowId },
    data: { status: "running", startedAt: new Date(), attempts: { increment: 1 } },
  });

  emitJobEvent({ type: "row_start", jobId, rowId, rowIndex, attendeeName, timestamp: Date.now() });

  try {
    const result = await runAgent(attendeeName, settings, jobId, rowId, rowIndex);

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
    updates.push({ colIndex: columnMap.doneCol, value: columnMap.doneValue });

    let writeAttempts = 0;
    while (writeAttempts < 5) {
      try {
        await writeRowResult(teamId, sheetId, tabName, rowIndex, updates);
        break;
      } catch (err) {
        writeAttempts++;
        if (writeAttempts >= 5) throw err;
        await sleep(2000 * writeAttempts);
      }
    }

    await db.jobRow.update({
      where: { id: rowId },
      data: { status: "success", result: result as object, completedAt: new Date(), error: null },
    });

    emitJobEvent({ type: "row_complete", jobId, rowId, rowIndex, attendeeName, result, timestamp: Date.now() });

    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    const updatedRow = await db.jobRow.update({
      where: { id: rowId },
      data: { error: errorMsg },
      select: { attempts: true },
    });

    emitJobEvent({ type: "row_error", jobId, rowId, rowIndex, attendeeName, error: errorMsg, timestamp: Date.now() });

    if (updatedRow.attempts >= 5) {
      await db.jobRow.update({ where: { id: rowId }, data: { status: "error", completedAt: new Date() } });
      return { success: false, final: true };
    }

    await db.jobRow.update({ where: { id: rowId }, data: { status: "pending" } });
    return { success: false, final: false };
  }
}

// ─── Template (enrichment) row processor ──────────────────────────────────────

async function processTemplateRow(
  jobRecord: {
    id: string;
    templateSlug: string;
    sheetId: string;
    tabName: string;
    destSheetId: string | null;
    destTabName: string | null;
    columnMap: EnrichmentColumnMap;
  },
  rowRecord: { id: string; rowIndex: number; rowData: string[] },
  teamId: string,
  settings: TemplateSettings,
  template: PipelineTemplate
) {
  const { id: jobId, templateSlug, sheetId, tabName, destSheetId, destTabName, columnMap } = jobRecord;
  const { id: rowId, rowIndex, rowData } = rowRecord;

  // Extract input values from row data using column index map
  const input: Record<string, string> = {};
  for (const [key, colIdx] of Object.entries(columnMap.inputCols)) {
    input[key] = rowData[colIdx] ?? "";
  }
  const attendeeName = input.gymName ?? `Row ${rowIndex}`;

  // ── Deduplication pre-check (gym_enrichment only) ─────────────────────────
  if (templateSlug === "gym_enrichment" && input.gymName) {
    const existing = await db.eventEnrichment.findFirst({
      where: { name_id: input.gymName },
      select: { id: true },
    });

    if (existing) {
      // Already enriched — mark done in source sheet and skip
      await writeRowResult(teamId, sheetId, tabName, rowIndex, [
        { colIndex: columnMap.doneCol, value: columnMap.doneValue },
      ]);

      await db.jobRow.update({
        where: { id: rowId },
        data: {
          status: "skipped",
          result: { skipped: true, reason: "Already exists in event_enrichments" } as object,
          completedAt: new Date(),
        },
      });

      emitJobEvent({
        type: "row_complete",
        jobId,
        rowId,
        rowIndex,
        attendeeName,
        result: { skipped: true, reason: "Already enriched" },
        timestamp: Date.now(),
      });

      return { success: true };
    }
  }

  await db.jobRow.update({
    where: { id: rowId },
    data: { status: "running", startedAt: new Date(), attempts: { increment: 1 } },
  });

  emitJobEvent({ type: "row_start", jobId, rowId, rowIndex, attendeeName, timestamp: Date.now() });

  try {
    const result = await template.run(
      input,
      settings,
      { emit: (event) => emitJobEvent({ ...event, timestamp: Date.now() }) },
      { jobId, rowId, rowIndex }
    );

    // Write back to source sheet (status, aiOwner, aiCoach + doneCol)
    const sourceUpdates: { colIndex: number; value: string }[] = [];
    if (result.sourceData) {
      for (const [key, colIdx] of Object.entries(columnMap.sourceOutputCols)) {
        const value = result.sourceData[key];
        if (value != null) {
          sourceUpdates.push({ colIndex: colIdx, value: String(value) });
        }
      }
    }
    sourceUpdates.push({ colIndex: columnMap.doneCol, value: columnMap.doneValue });

    let writeAttempts = 0;
    while (writeAttempts < 5) {
      try {
        await writeRowResult(teamId, sheetId, tabName, rowIndex, sourceUpdates);
        break;
      } catch (err) {
        writeAttempts++;
        if (writeAttempts >= 5) throw err;
        await sleep(2000 * writeAttempts);
      }
    }

    // Append enrichment result row to destination sheet
    if (destSheetId && destTabName && result.data) {
      const destEntries = Object.entries(columnMap.destOutputCols);
      if (destEntries.length > 0) {
        const maxColIdx = Math.max(...destEntries.map(([, idx]) => idx));
        const destRow = new Array(maxColIdx + 1).fill("");
        for (const [key, colIdx] of destEntries) {
          destRow[colIdx] = String(result.data[key] ?? "");
        }
        let appendAttempts = 0;
        while (appendAttempts < 5) {
          try {
            await appendRow(teamId, destSheetId, destTabName, destRow);
            break;
          } catch (err) {
            appendAttempts++;
            if (appendAttempts >= 5) throw err;
            await sleep(2000 * appendAttempts);
          }
        }
      }
    }

    // ── Write to event_enrichments DB (gym_enrichment only) ──────────────────
    if (templateSlug === "gym_enrichment" && result.success && input.gymName) {
      try {
        await upsertEventEnrichment(input.gymName, result);
      } catch (dbErr) {
        console.error("Failed to upsert event_enrichments:", dbErr);
        // Non-fatal — don't fail the row over a DB write issue
      }
    }

    await db.jobRow.update({
      where: { id: rowId },
      data: { status: "success", result: result as object, completedAt: new Date(), error: null },
    });

    emitJobEvent({ type: "row_complete", jobId, rowId, rowIndex, attendeeName, result, timestamp: Date.now() });

    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    const updatedRow = await db.jobRow.update({
      where: { id: rowId },
      data: { error: errorMsg },
      select: { attempts: true },
    });

    emitJobEvent({ type: "row_error", jobId, rowId, rowIndex, attendeeName, error: errorMsg, timestamp: Date.now() });

    if (updatedRow.attempts >= 5) {
      await db.jobRow.update({ where: { id: rowId }, data: { status: "error", completedAt: new Date() } });
      return { success: false, final: true };
    }

    await db.jobRow.update({ where: { id: rowId }, data: { status: "pending" } });
    return { success: false, final: false };
  }
}

// ─── Main job processor ───────────────────────────────────────────────────────

async function processJob(bullJob: Job<JobPayload>) {
  const { jobId, teamId, onlyFailed } = bullJob.data;

  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { rows: true },
  });

  if (!job) throw new Error(`Job ${jobId} not found`);

  await db.job.update({
    where: { id: jobId },
    data: { status: "running", startedAt: new Date() },
  });

  // Load all team settings in one DB query
  const settingsMap = await loadSettingsMap(teamId);

  const isTemplate = !!job.templateSlug;
  const columnMap = job.columnMap as unknown as ColumnMap | EnrichmentColumnMap;

  // Both ColumnMap and EnrichmentColumnMap share these top-level fields
  const filterCol = columnMap.filterCol;
  const filterValue = columnMap.filterValue;
  const rowOffset = columnMap.rowOffset ?? 0;
  const rowLimit = columnMap.rowLimit ?? 0;

  // Fetch rows from sheet if none in DB yet (first run)
  if (job.rows.length === 0 && !onlyFailed) {
    const sheetRows = await getUnprocessedRows(
      teamId,
      job.sheetId,
      job.tabName,
      filterCol,
      filterValue,
      rowOffset,
      rowLimit
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

  // Resolve template for template-based jobs
  let template: PipelineTemplate | null = null;
  if (isTemplate) {
    template = getTemplate(job.templateSlug!);
    if (!template) throw new Error(`Unknown template: ${job.templateSlug}`);
  }

  const rows = await db.jobRow.findMany({
    where: { jobId, status: "pending" },
    orderBy: { rowIndex: "asc" },
  });

  let doneRows = job.doneRows;
  let errorRows = job.errorRows;

  for (const row of rows) {
    // Check if job was stopped between rows
    const currentStatus = await db.job.findUnique({
      where: { id: jobId },
      select: { status: true },
    });
    if (currentStatus?.status === "paused") {
      await db.jobRow.updateMany({
        where: { jobId, status: "running" },
        data: { status: "pending" },
      });
      emitJobEvent({ type: "job_stopped", jobId, timestamp: Date.now() });
      return;
    }

    const rowData = row.rowData as unknown as string[];
    let attempts = 0;
    let success = false;

    while (!success && attempts < 5) {
      let outcome;

      if (isTemplate && template) {
        outcome = await processTemplateRow(
          {
            id: jobId,
            templateSlug: job.templateSlug!,
            sheetId: job.sheetId,
            tabName: job.tabName,
            destSheetId: job.destSheetId ?? null,
            destTabName: job.destTabName ?? null,
            columnMap: columnMap as EnrichmentColumnMap,
          },
          { id: row.id, rowIndex: row.rowIndex, rowData },
          teamId,
          buildTemplateSettings(settingsMap),
          template
        );
      } else {
        outcome = await processRow(
          {
            id: jobId,
            sheetId: job.sheetId,
            tabName: job.tabName,
            columnMap: columnMap as ColumnMap,
          },
          { id: row.id, rowIndex: row.rowIndex, rowData },
          teamId,
          buildAgentSettings(settingsMap)
        );
      }

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

    await sleep(1000);
  }

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

// ─── Worker singleton ─────────────────────────────────────────────────────────

const globalForWorker = globalThis as unknown as {
  bjjWorker: Worker | undefined;
};

export function startWorker() {
  if (globalForWorker.bjjWorker) return globalForWorker.bjjWorker;

  const worker = new Worker(JOB_QUEUE_NAME, processJob, {
    connection: getRedisConnection(),
    concurrency: 3,
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
