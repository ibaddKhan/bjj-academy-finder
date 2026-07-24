import { redirect, notFound } from "next/navigation";
import { getServerAuthUser } from "@/lib/auth/middleware";
import { db } from "@/lib/db";
import { Navbar } from "@/components/Navbar";
import { JobProgressView } from "@/components/JobProgressView";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowLeft, Building2, User } from "lucide-react";

interface ColumnMap {
  nameCol: number;
}

export default async function JobDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getServerAuthUser();
  if (!user) redirect("/login");

  const where =
    user.role === "super_admin"
      ? { id: params.id }
      : { id: params.id, teamId: user.teamId };

  const job = await db.job.findFirst({
    where,
    include: { rows: { orderBy: { rowIndex: "asc" } } },
  });

  if (!job) notFound();

  const columnMap = job.columnMap as unknown as ColumnMap;
  const isEnrichment = !!job.templateSlug;

  const initialRows = job.rows.map((row) => {
    const rowData = row.rowData as unknown as string[];
    return {
      id: row.id,
      rowIndex: row.rowIndex,
      attendeeName: rowData[columnMap.nameCol] ?? `Row ${row.rowIndex}`,
      status: row.status as "pending" | "running" | "success" | "error" | "skipped",
      result: row.result as unknown as Record<string, string | null> | null,
      error: row.error,
      toolLog: (row.toolLog as unknown as Array<{
        type: "tool_call" | "tool_result";
        tool: string;
        input?: unknown;
        output?: unknown;
        timestamp: number;
      }>) ?? [],
      attempts: row.attempts,
    };
  });

  const initialJob = {
    id: job.id,
    status: job.status,
    totalRows: job.totalRows,
    doneRows: job.doneRows,
    errorRows: job.errorRows,
    tabName: job.tabName,
    sheetUrl: job.sheetUrl,
    templateSlug: job.templateSlug ?? null,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
  };

  return (
    <div className="min-h-screen">
      <Navbar user={user} />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2">
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-1" />
              All Jobs
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Job: {job.tabName}</h1>
            <Badge variant={isEnrichment ? "default" : "outline"}>
              {isEnrichment ? (
                <><Building2 className="h-3 w-3 mr-1" />Gym Enrichment</>
              ) : (
                <><User className="h-3 w-3 mr-1" />Person Finder</>
              )}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1 truncate">
            {job.sheetUrl}
          </p>
        </div>

        <JobProgressView
          jobId={job.id}
          initialJob={initialJob}
          initialRows={initialRows}
        />
      </main>
    </div>
  );
}
