"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { SheetConnector } from "@/components/SheetConnector";
import { ColumnMapper } from "@/components/ColumnMapper";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

const STORAGE_KEY = "bjj_last_job_config";

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
  rowOffset: number;
  rowLimit: number;
  outputCols: {
    foundGym?: number;
    instagram?: number;
    facebook?: number;
    smoothcomp?: number;
    source?: number;
    reason?: number;
  };
}

interface SavedConfig {
  sheetUrl: string;
  tabName: string;
  columnMap: ColumnMap;
}

const STEPS = ["Connect Sheet", "Map Columns", "Launch"];

export default function NewJobPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [sheetInfo, setSheetInfo] = useState<SheetInfo | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [savedConfig, setSavedConfig] = useState<SavedConfig | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSavedConfig(JSON.parse(raw));
    } catch {
      // ignore corrupt storage
    }
  }, []);

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

      const config: SavedConfig = {
        sheetUrl: sheetInfo.sheetUrl,
        tabName: sheetInfo.tabName,
        columnMap,
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      } catch {
        // ignore
      }

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
          <h1 className="text-2xl font-bold">New Person Finder Job</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Connect a Google Sheet and configure the column mapping to find BJJ gyms
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
              {i < STEPS.length - 1 && <div className="h-px w-8 bg-border" />}
            </div>
          ))}
        </div>

        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Connect Google Sheet</CardTitle>
              <CardDescription>
                Paste your Google Sheet URL. Make sure it&apos;s shared with your
                team&apos;s service account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SheetConnector
                onConnected={handleConnected}
                defaultUrl={savedConfig?.sheetUrl}
                defaultTabName={savedConfig?.tabName}
              />
            </CardContent>
          </Card>
        )}

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
                defaultValues={
                  savedConfig?.tabName === sheetInfo.tabName
                    ? savedConfig.columnMap
                    : undefined
                }
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
