"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { SheetConnector } from "@/components/SheetConnector";
import { ColumnMapper } from "@/components/ColumnMapper";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

interface SheetInfo {
  sheetUrl: string;
  sheetId: string;
  tabId: string;
  tabName: string;
}

interface ColumnMap {
  nameCol: number;
  filterCol: number;
  filterValue: string;
  doneCol: number;
  doneValue: string;
  outputCols: {
    foundGym?: number;
    instagram?: number;
    facebook?: number;
    smoothcomp?: number;
    source?: number;
    reason?: number;
  };
}

const STEPS = ["Connect Sheet", "Map Columns", "Launch"];

export default function NewJobPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [sheetInfo, setSheetInfo] = useState<SheetInfo | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  function handleConnected(info: SheetInfo) {
    setSheetInfo(info);
    setStep(1);
  }

  async function handleLaunch(columnMap: ColumnMap) {
    if (!sheetInfo) return;
    setIsLaunching(true);
    setLaunchError(null);

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...sheetInfo, columnMap }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create job");

      router.push(`/jobs/${data.job.id}`);
    } catch (err) {
      setLaunchError(err instanceof Error ? err.message : "Launch failed");
      setIsLaunching(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">New Job</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Connect a Google Sheet and configure the column mapping
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-6">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 text-sm font-medium ${
                  i < step
                    ? "text-green-500"
                    : i === step
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                {i < step ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <span className="h-5 w-5 rounded-full border-2 border-current flex items-center justify-center text-xs">
                    {i + 1}
                  </span>
                )}
                {label}
              </div>
              {i < STEPS.length - 1 && (
                <div className="h-px w-8 bg-border" />
              )}
            </div>
          ))}
        </div>

        {/* Step 0: Connect Sheet */}
        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Connect Google Sheet</CardTitle>
              <CardDescription>
                Paste your Google Sheet URL. Make sure it&apos;s accessible by
                your signed-in Google account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SheetConnector onConnected={handleConnected} />
            </CardContent>
          </Card>
        )}

        {/* Step 1: Map Columns */}
        {step === 1 && sheetInfo && (
          <Card>
            <CardHeader>
              <CardTitle>Map Columns</CardTitle>
              <CardDescription>
                Tab: <strong>{sheetInfo.tabName}</strong> — Configure which
                columns to read from and write to.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ColumnMapper
                sheetId={sheetInfo.sheetId}
                tabName={sheetInfo.tabName}
                onLaunch={handleLaunch}
                isLaunching={isLaunching}
              />
              {launchError && (
                <p className="mt-3 text-sm text-destructive">{launchError}</p>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
