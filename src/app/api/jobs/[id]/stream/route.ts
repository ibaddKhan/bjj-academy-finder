import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/middleware";
import { db } from "@/lib/db";
import { subscribeToJob, SSEEvent } from "@/lib/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jobFilter(user: { userId: string; teamId?: string; role: string }) {
  if (user.role === "super_admin") return {};
  return { teamId: user.teamId };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = getAuthUser(req);
  if (!user) return new Response("Unauthorized", { status: 401 });

  // Verify job belongs to user's team
  const job = await db.job.findFirst({
    where: { id: params.id, ...jobFilter(user) },
  });

  if (!job) return new Response("Job not found", { status: 404 });

  const jobId = params.id;

  const stream = new ReadableStream({
    start(controller) {
      function send(event: SSEEvent) {
        try {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(new TextEncoder().encode(data));
        } catch {
          // Client disconnected
        }
      }

      // Send initial heartbeat
      send({
        type: "job_progress",
        jobId,
        doneRows: job.doneRows,
        errorRows: job.errorRows,
        totalRows: job.totalRows,
        timestamp: Date.now(),
      });

      const unsubscribe = subscribeToJob(jobId, send);

      const cleanup = () => {
        unsubscribe();
      };

      // Close stream when job completes
      subscribeToJob(jobId, (event) => {
        if (event.type === "job_complete" || event.type === "job_failed") {
          setTimeout(() => {
            cleanup();
            try {
              controller.close();
            } catch {
              // Already closed
            }
          }, 1000);
        }
      });

      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
