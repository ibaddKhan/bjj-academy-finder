import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Navbar } from "@/components/Navbar";
import { JobProgressView } from "@/components/JobProgressView";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface ColumnMap {
  nameCol: number;
}

export default async function JobDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const job = await db.job.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: {
      rows: {
        orderBy: { rowIndex: "asc" },
      },
    },
  });

  if (!job) notFound();

  const columnMap = job.columnMap as unknown as ColumnMap;

  const initialRows = job.rows.map((row) => {
    const rowData = row.rowData as unknown as string[];
    return {
      id: row.id,
      rowIndex: row.rowIndex,
      attendeeName: rowData[columnMap.nameCol] ?? `Row ${row.rowIndex}`,
      status: row.status as "pending" | "running" | "success" | "error" | "skipped",
      result: row.result as unknown as {
        foundGym: string | null;
        instagram: string | null;
        facebook: string | null;
        smoothcomp: string | null;
        source: string | null;
        reason: string;
      } | null,
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
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2">
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-1" />
              All Jobs
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Job: {job.tabName}</h1>
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
