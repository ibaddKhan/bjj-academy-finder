"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RowLogCard } from "@/components/RowLogCard";
import { CheckCircle2, XCircle, Loader2, RotateCcw, RefreshCcw, Square } from "lucide-react";
import { SSEEvent } from "@/lib/events";

interface AgentResult {
  foundGym: string | null;
  instagram: string | null;
  facebook: string | null;
  smoothcomp: string | null;
  source: string | null;
  reason: string;
}

interface ToolLogEntry {
  type: "tool_call" | "tool_result";
  tool: string;
  input?: unknown;
  output?: unknown;
  timestamp: number;
}

interface RowState {
  id: string;
  rowIndex: number;
  attendeeName: string;
  status: "pending" | "running" | "success" | "error" | "skipped";
  result?: AgentResult | null;
  error?: string | null;
  toolLog: ToolLogEntry[];
  attempts: number;
}

interface JobState {
  id: string;
  status: string;
  totalRows: number;
  doneRows: number;
  errorRows: number;
  tabName: string;
  sheetUrl: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface JobProgressViewProps {
  jobId: string;
  initialJob: JobState;
  initialRows: RowState[];
}

export function JobProgressView({
  jobId,
  initialJob,
  initialRows,
}: JobProgressViewProps) {
  const [job, setJob] = useState<JobState>(initialJob);
  const [rows, setRows] = useState<Map<string, RowState>>(
    new Map(initialRows.map((r) => [r.id, r]))
  );
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [isStopping, setIsStopping] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`/api/jobs/${jobId}/stream`);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const event: SSEEvent = JSON.parse(e.data);
        handleSSEEvent(event);
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      // Reconnect after 3 seconds if job isn't complete/stopped
      setTimeout(() => {
        if (
          job.status !== "completed" &&
          job.status !== "failed" &&
          job.status !== "paused"
        ) {
          connectSSE();
        }
      }, 3000);
    };
  }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (job.status === "running" || job.status === "queued") {
      connectSSE();
    }
    return () => {
      eventSourceRef.current?.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Live elapsed timer
  useEffect(() => {
    if (!job.startedAt) return;

    if (job.completedAt) {
      // Job finished — show fixed total duration
      setElapsed(new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime());
      return;
    }

    // Job running — tick every second
    const tick = () => setElapsed(Date.now() - new Date(job.startedAt!).getTime());
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [job.startedAt, job.completedAt]);

  function handleSSEEvent(event: SSEEvent) {
    switch (event.type) {
      case "row_start":
        if (event.rowId) {
          setRows((prev) => {
            const next = new Map(prev);
            const existing = next.get(event.rowId!) ?? {
              id: event.rowId!,
              rowIndex: event.rowIndex ?? 0,
              attendeeName: event.attendeeName ?? "",
              status: "pending" as const,
              toolLog: [],
              attempts: 0,
            };
            next.set(event.rowId!, {
              ...existing,
              status: "running",
              attendeeName: event.attendeeName ?? existing.attendeeName,
              attempts: existing.attempts + 1,
            });
            return next;
          });
        }
        break;

      case "tool_call":
        if (event.rowId) {
          setRows((prev) => {
            const next = new Map(prev);
            const row = next.get(event.rowId!);
            if (row) {
              next.set(event.rowId!, {
                ...row,
                toolLog: [
                  ...row.toolLog,
                  {
                    type: "tool_call",
                    tool: event.tool ?? "",
                    input: event.input,
                    timestamp: event.timestamp,
                  },
                ],
              });
            }
            return next;
          });
        }
        break;

      case "tool_result":
        if (event.rowId) {
          setRows((prev) => {
            const next = new Map(prev);
            const row = next.get(event.rowId!);
            if (row) {
              next.set(event.rowId!, {
                ...row,
                toolLog: [
                  ...row.toolLog,
                  {
                    type: "tool_result",
                    tool: event.tool ?? "",
                    output: event.output,
                    timestamp: event.timestamp,
                  },
                ],
              });
            }
            return next;
          });
        }
        break;

      case "row_complete":
        if (event.rowId) {
          setRows((prev) => {
            const next = new Map(prev);
            const row = next.get(event.rowId!);
            if (row) {
              next.set(event.rowId!, {
                ...row,
                status: "success",
                result: event.result as AgentResult,
              });
            }
            return next;
          });
        }
        break;

      case "row_error":
        if (event.rowId) {
          setRows((prev) => {
            const next = new Map(prev);
            const row = next.get(event.rowId!);
            if (row) {
              next.set(event.rowId!, {
                ...row,
                status: row.attempts >= 5 ? "error" : "running",
                error: event.error,
              });
            }
            return next;
          });
        }
        break;

      case "job_progress":
        setJob((prev) => ({
          ...prev,
          doneRows: event.doneRows ?? prev.doneRows,
          errorRows: event.errorRows ?? prev.errorRows,
          totalRows: event.totalRows ?? prev.totalRows,
        }));
        break;

      case "job_complete":
        setJob((prev) => ({ ...prev, status: "completed", completedAt: new Date().toISOString() }));
        eventSourceRef.current?.close();
        if (timerRef.current) clearInterval(timerRef.current);
        break;

      case "job_failed":
        setJob((prev) => ({ ...prev, status: "failed", completedAt: new Date().toISOString() }));
        eventSourceRef.current?.close();
        if (timerRef.current) clearInterval(timerRef.current);
        break;

      case "job_stopped":
        setJob((prev) => ({ ...prev, status: "paused", completedAt: new Date().toISOString() }));
        eventSourceRef.current?.close();
        if (timerRef.current) clearInterval(timerRef.current);
        break;
    }
  }

  async function handleRetryAll() {
    setIsRetrying(true);
    setRetryError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/retry`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Retry failed");
      setJob((prev) => ({ ...prev, status: "queued", errorRows: 0 }));
      connectSSE();
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setIsRetrying(false);
    }
  }

  async function handleResume() {
    setIsRetrying(true);
    setRetryError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/resume`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Resume failed");
      setJob((prev) => ({ ...prev, status: "queued" }));
      connectSSE();
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : "Resume failed");
    } finally {
      setIsRetrying(false);
    }
  }

  async function handleStop() {
    setIsStopping(true);
    try {
      await fetch(`/api/jobs/${jobId}/stop`, { method: "POST" });
      setJob((prev) => ({ ...prev, status: "paused" }));
      eventSourceRef.current?.close();
    } finally {
      setIsStopping(false);
    }
  }

  async function handleRefresh() {
    const res = await fetch(`/api/jobs/${jobId}`);
    const data = await res.json();
    if (data.job) {
      setJob({
        ...data.job,
        startedAt: data.job.startedAt ?? null,
        completedAt: data.job.completedAt ?? null,
      });
      const newRows = new Map<string, RowState>();
      for (const row of data.job.rows ?? []) {
        newRows.set(row.id, {
          ...row,
          attendeeName: (row.rowData as string[])?.[0] ?? "",
          toolLog: (row.toolLog as ToolLogEntry[]) ?? [],
        });
      }
      setRows(newRows);
    }
  }

  function formatDuration(ms: number) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m}m ${sec}s`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
  }

  const rowList = Array.from(rows.values()).sort(
    (a, b) => a.rowIndex - b.rowIndex
  );
  const progressPct =
    job.totalRows > 0
      ? Math.round(((job.doneRows + job.errorRows) / job.totalRows) * 100)
      : 0;

  const errorRows = rowList.filter((r) => r.status === "error");
  const isActive = job.status === "running" || job.status === "queued";

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="border rounded-lg p-4 space-y-3 bg-card">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            {isActive && (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            )}
            <div>
              <p className="font-semibold">
                {job.tabName}{" "}
                <span className="text-muted-foreground text-sm font-normal">
                  — {job.sheetUrl.slice(0, 60)}…
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                Processed {job.doneRows + job.errorRows} / {job.totalRows} rows
                {isActive && " · Running…"}
                {job.startedAt && elapsed > 0 && (
                  <span className="ml-2">
                    · {isActive ? "⏱ " : "took "}{formatDuration(elapsed)}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>{job.doneRows}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <XCircle className="h-4 w-4 text-destructive" />
              <span>{job.errorRows}</span>
            </div>

            <Badge
              variant={
                job.status === "completed"
                  ? "success"
                  : job.status === "failed"
                  ? "destructive"
                  : job.status === "running"
                  ? "default"
                  : "secondary"
              }
            >
              {job.status}
            </Badge>

            {isActive && (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleStop}
                disabled={isStopping}
              >
                {isStopping ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <Square className="h-3.5 w-3.5 mr-1" />
                )}
                Stop
              </Button>
            )}

            <Button size="sm" variant="ghost" onClick={handleRefresh}>
              <RefreshCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <Progress value={progressPct} className="h-2" />

        {/* Resume stopped job */}
        {job.status === "paused" && (
          <div className="flex items-center gap-3 pt-1">
            <p className="text-sm text-muted-foreground">
              Job stopped. Unprocessed rows are still pending.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleResume}
              disabled={isRetrying}
            >
              {isRetrying ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              Resume
            </Button>
          </div>
        )}

        {/* Retry all failed */}
        {errorRows.length > 0 && job.status === "completed" && (
          <div className="flex items-center gap-3 pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRetryAll}
              disabled={isRetrying}
            >
              {isRetrying ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              Retry {errorRows.length} failed row
              {errorRows.length !== 1 ? "s" : ""}
            </Button>
            {retryError && (
              <p className="text-sm text-destructive">{retryError}</p>
            )}
          </div>
        )}
      </div>

      {/* Row cards */}
      <div className="space-y-2">
        {rowList.length === 0 && isActive && (
          <div className="text-center text-muted-foreground py-8">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Fetching rows from sheet…
          </div>
        )}

        {rowList.map((row) => (
          <RowLogCard
            key={row.id}
            rowId={row.id}
            rowIndex={row.rowIndex}
            attendeeName={row.attendeeName}
            status={row.status}
            result={row.result}
            error={row.error}
            toolLog={row.toolLog}
            attempts={row.attempts}
            isLive={isActive}
          />
        ))}
      </div>
    </div>
  );
}
