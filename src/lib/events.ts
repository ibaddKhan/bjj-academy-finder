import { EventEmitter } from "events";

// In-process pub/sub for SSE streaming
// One global EventEmitter keyed by jobId
const globalForEmitter = globalThis as unknown as {
  jobEmitter: EventEmitter | undefined;
};

if (!globalForEmitter.jobEmitter) {
  globalForEmitter.jobEmitter = new EventEmitter();
  globalForEmitter.jobEmitter.setMaxListeners(100);
}

export const jobEmitter = globalForEmitter.jobEmitter!;

export type SSEEventType =
  | "row_start"
  | "tool_call"
  | "tool_result"
  | "row_complete"
  | "row_error"
  | "job_progress"
  | "job_complete"
  | "job_failed"
  | "job_stopped";

export interface SSEEvent {
  type: SSEEventType;
  jobId: string;
  rowId?: string;
  rowIndex?: number;
  attendeeName?: string;
  tool?: string;
  input?: unknown;
  output?: unknown;
  result?: unknown;
  error?: string;
  doneRows?: number;
  errorRows?: number;
  totalRows?: number;
  timestamp: number;
}

export function emitJobEvent(event: SSEEvent) {
  jobEmitter.emit(`job:${event.jobId}`, event);
}

export function subscribeToJob(
  jobId: string,
  handler: (event: SSEEvent) => void
): () => void {
  const channel = `job:${jobId}`;
  jobEmitter.on(channel, handler);
  return () => jobEmitter.off(channel, handler);
}
