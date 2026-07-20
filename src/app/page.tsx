import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" }> = {
  queued: { label: "Queued", variant: "secondary" },
  running: { label: "Running", variant: "default" },
  completed: { label: "Completed", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
  paused: { label: "Paused", variant: "warning" },
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const jobs = await db.job.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Jobs</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Your BJJ academy lookup jobs
            </p>
          </div>
          <Button asChild>
            <Link href="/jobs/new">
              <Plus className="h-4 w-4 mr-2" />
              New Job
            </Link>
          </Button>
        </div>

        {jobs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Clock className="h-12 w-12 text-muted-foreground mb-4" />
              <CardTitle className="text-lg mb-2">No jobs yet</CardTitle>
              <CardDescription className="mb-4">
                Connect a Google Sheet and start finding BJJ academies.
              </CardDescription>
              <Button asChild>
                <Link href="/jobs/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Create your first job
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const cfg = STATUS_BADGE[job.status] ?? STATUS_BADGE.queued;
              const pct =
                job.totalRows > 0
                  ? Math.round(
                      ((job.doneRows + job.errorRows) / job.totalRows) * 100
                    )
                  : 0;

              return (
                <Link key={job.id} href={`/jobs/${job.id}`}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                    <CardContent className="py-4 px-5">
                      <div className="flex items-center gap-4">
                        {/* Status icon */}
                        <div className="shrink-0">
                          {job.status === "running" ? (
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          ) : job.status === "completed" ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : job.status === "failed" ? (
                            <XCircle className="h-5 w-5 text-destructive" />
                          ) : (
                            <Clock className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{job.tabName}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {job.sheetUrl}
                          </p>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-4 shrink-0">
                          {job.totalRows > 0 && (
                            <div className="text-sm text-muted-foreground hidden sm:block">
                              <span className="text-green-400">{job.doneRows}</span>
                              {" / "}
                              {job.totalRows}
                              {job.errorRows > 0 && (
                                <span className="text-destructive ml-1">
                                  ({job.errorRows} err)
                                </span>
                              )}
                            </div>
                          )}

                          <Badge variant={cfg.variant}>{cfg.label}</Badge>

                          <p className="text-xs text-muted-foreground hidden md:block">
                            {new Date(job.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {/* Progress bar for active jobs */}
                      {job.totalRows > 0 && job.status !== "queued" && (
                        <div className="mt-3 h-1 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
