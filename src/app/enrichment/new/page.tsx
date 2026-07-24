"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { SheetConnector } from "@/components/SheetConnector";
import { DestinationSheetConnector } from "@/components/DestinationSheetConnector";
import { TemplateColumnMapper } from "@/components/TemplateColumnMapper";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Building2 } from "lucide-react";

interface SheetInfo {
  sheetUrl: string;
  sheetId: string;
  tabId: string;
  tabName: string;
}

const STEPS = ["Source Sheet", "Destination Sheet", "Map Columns", "Launch"];

const GYM_TEMPLATE_SLUG = "gym_enrichment";

export default function EnrichmentNewPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [sourceSheet, setSourceSheet] = useState<SheetInfo | null>(null);
  const [destSheet, setDestSheet] = useState<SheetInfo | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  async function handleLaunch(columnMap: object) {
    if (!sourceSheet || !destSheet) return;
    setIsLaunching(true);
    setLaunchError(null);

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetUrl: sourceSheet.sheetUrl,
          sheetId: sourceSheet.sheetId,
          tabId: sourceSheet.tabId,
          tabName: sourceSheet.tabName,
          destSheetId: destSheet.sheetId,
          destTabName: destSheet.tabName,
          columnMap,
          templateSlug: GYM_TEMPLATE_SLUG,
        }),
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
        <div className="mb-6 flex items-center gap-3">
          <Building2 className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Gym Enrichment Job</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              2-stage AI pipeline: discover gym links → scrape → extract structured data
            </p>
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
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

        {/* Step 0: Source Sheet */}
        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Source Sheet</CardTitle>
              <CardDescription>
                The sheet containing gym names and locations to enrich.
                Must be shared with your team&apos;s service account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SheetConnector
                onConnected={(info) => {
                  setSourceSheet(info);
                  setStep(1);
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Step 1: Destination Sheet */}
        {step === 1 && sourceSheet && (
          <Card>
            <CardHeader>
              <CardTitle>Destination Sheet</CardTitle>
              <CardDescription>
                Where enrichment results will be appended. Can be the same sheet or a separate one.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DestinationSheetConnector
                sourceSheetUrl={sourceSheet.sheetUrl}
                onConnected={(info) => {
                  setDestSheet(info);
                  setStep(2);
                }}
              />
              <div className="mt-4">
                <Button variant="ghost" size="sm" onClick={() => setStep(0)}>
                  ← Back
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Map Columns */}
        {step === 2 && sourceSheet && destSheet && (
          <Card>
            <CardHeader>
              <CardTitle>Map Columns</CardTitle>
              <CardDescription>
                Source: <strong>{sourceSheet.tabName}</strong> → Dest:{" "}
                <strong>{destSheet.tabName}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TemplateColumnMapper
                templateSlug={GYM_TEMPLATE_SLUG}
                sourceSheetId={sourceSheet.sheetId}
                sourceTabName={sourceSheet.tabName}
                destSheetId={destSheet.sheetId}
                destTabName={destSheet.tabName}
                onLaunch={handleLaunch}
                isLaunching={isLaunching}
              />
              {launchError && (
                <p className="mt-3 text-sm text-destructive">{launchError}</p>
              )}
              <div className="mt-4">
                <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                  ← Back
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
