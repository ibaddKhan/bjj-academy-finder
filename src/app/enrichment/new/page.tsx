"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { SheetConnector } from "@/components/SheetConnector";
import { TemplateColumnMapper } from "@/components/TemplateColumnMapper";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Building2, Loader2 } from "lucide-react";
import { INDUSTRY_PRESET_OPTIONS, DEFAULT_INDUSTRY_SLUG } from "@/lib/industries";

interface SheetInfo {
  sheetUrl: string;
  sheetId: string;
  tabId: string;
  tabName: string;
}

interface SavedEnrichmentConfig {
  sheetUrl: string;
  tabName: string;
  columnMap: object;
  destSheetUrl?: string;
  destTabName?: string;
  destOutputCols?: Record<string, number>;
}

const STEPS = ["Source Sheet", "Map Columns", "Launch"];

const GYM_TEMPLATE_SLUG = "gym_enrichment";

const DEST_OUTPUT_FIELDS = [
  { key: "inputGymName", label: "Input Gym Name (lookup key)" },
  { key: "name", label: "Gym Name" },
  { key: "website", label: "Website" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "locations", label: "Location(s)" },
  { key: "owners", label: "Owners" },
  { key: "coaches", label: "Coaches" },
  { key: "industry", label: "Industry" },
  { key: "social_media", label: "Social Media" },
  { key: "detected_software", label: "Software Detected" },
  { key: "confidence_score", label: "Confidence Score" },
  { key: "status", label: "Status" },
  { key: "reason", label: "Reason" },
  { key: "smoothcomp", label: "Smoothcomp URL" },
  { key: "owner_instagram", label: "Owner Instagram" },
];

const SKIP = "__skip__";

export default function EnrichmentNewPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [sourceSheet, setSourceSheet] = useState<SheetInfo | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [industry, setIndustry] = useState(DEFAULT_INDUSTRY_SLUG);
  const [savedConfig, setSavedConfig] = useState<SavedEnrichmentConfig | null>(null);

  // Destination sheet state
  const [enableDestSheet, setEnableDestSheet] = useState(false);
  const [destSheet, setDestSheet] = useState<SheetInfo | null>(null);
  const [destHeaders, setDestHeaders] = useState<string[]>([]);
  const [destHeadersLoading, setDestHeadersLoading] = useState(false);
  const [destOutputCols, setDestOutputCols] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/settings/saved-config?key=lastEnrichmentConfig")
      .then((r) => r.json())
      .then((d) => {
        if (d.config) {
          setSavedConfig(d.config);
          if (d.config.destSheetUrl && d.config.destOutputCols) {
            setEnableDestSheet(true);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Fetch dest sheet headers when connected
  useEffect(() => {
    if (!destSheet) return;
    setDestHeadersLoading(true);
    fetch(
      `/api/sheets/headers?sheetId=${encodeURIComponent(destSheet.sheetId)}&tabName=${encodeURIComponent(destSheet.tabName)}`
    )
      .then((r) => r.json())
      .then((data) => {
        setDestHeaders(data.headers ?? []);
        // Restore saved dest column mapping if tab matches
        if (savedConfig?.destOutputCols && savedConfig.destTabName === destSheet.tabName) {
          const cols: Record<string, string> = {};
          for (const [k, v] of Object.entries(savedConfig.destOutputCols)) {
            cols[k] = String(v);
          }
          setDestOutputCols(cols);
        }
      })
      .catch(() => setDestHeaders([]))
      .finally(() => setDestHeadersLoading(false));
  }, [destSheet]);

  async function handleLaunch(columnMap: object) {
    if (!sourceSheet) return;
    setIsLaunching(true);
    setLaunchError(null);

    // Build dest output cols map (string → number)
    const destOutMap: Record<string, number> = {};
    if (enableDestSheet && destSheet) {
      for (const f of DEST_OUTPUT_FIELDS) {
        const val = destOutputCols[f.key];
        if (val && val !== SKIP) destOutMap[f.key] = parseInt(val, 10);
      }
    }

    const finalColumnMap = {
      ...(columnMap as object),
      industry,
      ...(enableDestSheet && destSheet && Object.keys(destOutMap).length > 0
        ? { destOutputCols: destOutMap }
        : {}),
    };

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetUrl: sourceSheet.sheetUrl,
          sheetId: sourceSheet.sheetId,
          tabId: sourceSheet.tabId,
          tabName: sourceSheet.tabName,
          columnMap: finalColumnMap,
          templateSlug: GYM_TEMPLATE_SLUG,
          ...(enableDestSheet && destSheet
            ? { destSheetId: destSheet.sheetId, destTabName: destSheet.tabName }
            : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create job");

      // Save config server-side (team-scoped) — fire and forget
      fetch("/api/settings/saved-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "lastEnrichmentConfig",
          value: {
            sheetUrl: sourceSheet.sheetUrl,
            tabName: sourceSheet.tabName,
            columnMap,
            ...(enableDestSheet && destSheet
              ? {
                  destSheetUrl: destSheet.sheetUrl,
                  destTabName: destSheet.tabName,
                  destOutputCols: destOutMap,
                }
              : {}),
          },
        }),
      }).catch(() => {});

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
                The sheet containing entity names and locations to enrich.
                Must be shared with your team&apos;s service account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Industry</label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {INDUSTRY_PRESET_OPTIONS.map((opt) => (
                    <option key={opt.slug} value={opt.slug}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Determines the AI search keywords and prompts for this job.
                </p>
              </div>
              <SheetConnector
                onConnected={(info) => {
                  setSourceSheet(info);
                  setStep(1);
                }}
                defaultUrl={savedConfig?.sheetUrl}
                defaultTabName={savedConfig?.tabName}
              />
            </CardContent>
          </Card>
        )}

        {/* Step 1: Map Columns */}
        {step === 1 && sourceSheet && (
          <Card>
            <CardHeader>
              <CardTitle>Map Columns</CardTitle>
              <CardDescription>
                Map source sheet columns for input and status tracking.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TemplateColumnMapper
                templateSlug={GYM_TEMPLATE_SLUG}
                sourceSheetId={sourceSheet.sheetId}
                sourceTabName={sourceSheet.tabName}
                onLaunch={handleLaunch}
                isLaunching={isLaunching}
                defaultValues={
                  savedConfig?.tabName === sourceSheet.tabName
                    ? (savedConfig.columnMap as object)
                    : undefined
                }
              >
                {/* Destination Sheet (optional) */}
                <div className="space-y-4">
                  <div className="border-t pt-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableDestSheet}
                        onChange={(e) => {
                          setEnableDestSheet(e.target.checked);
                          if (!e.target.checked) {
                            setDestSheet(null);
                            setDestHeaders([]);
                            setDestOutputCols({});
                          }
                        }}
                        className="h-4 w-4 rounded border-input"
                      />
                      <span className="text-sm font-medium">Write full results to a destination sheet</span>
                    </label>
                    <p className="text-xs text-muted-foreground mt-1 ml-6">
                      Optionally append all enrichment fields to a separate Google Sheet.
                    </p>
                  </div>

                  {enableDestSheet && (
                    <div className="space-y-4 pl-6">
                      {!destSheet ? (
                        <SheetConnector
                          onConnected={(info) => setDestSheet(info)}
                          defaultUrl={savedConfig?.destSheetUrl}
                          defaultTabName={savedConfig?.destTabName}
                        />
                      ) : (
                        <>
                          <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                            <span className="text-muted-foreground">
                              Connected: <span className="text-foreground font-medium">{destSheet.tabName}</span>
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDestSheet(null);
                                setDestHeaders([]);
                                setDestOutputCols({});
                              }}
                            >
                              Change
                            </Button>
                          </div>

                          {destHeadersLoading ? (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading destination columns...
                            </div>
                          ) : destHeaders.length > 0 ? (
                            <div className="space-y-4">
                              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                                Map Output Fields to Destination Columns
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                Select which destination column each enrichment field should be written to. Skip any fields you don&apos;t need.
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {DEST_OUTPUT_FIELDS.map((f) => (
                                  <div key={f.key} className="space-y-2">
                                    <Label>{f.label}</Label>
                                    <Select
                                      value={destOutputCols[f.key] ?? SKIP}
                                      onValueChange={(val) =>
                                        setDestOutputCols((prev) => ({ ...prev, [f.key]: val }))
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="— skip —" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value={SKIP}>— skip —</SelectItem>
                                        {destHeaders.map((h, i) => (
                                          <SelectItem key={i} value={String(i)}>
                                            {h || `Column ${i + 1}`} (col {i + 1})
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No headers found in the destination sheet. Make sure the first row has column headers.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </TemplateColumnMapper>
              {launchError && (
                <p className="mt-3 text-sm text-destructive">{launchError}</p>
              )}
              <div className="mt-4">
                <Button variant="ghost" size="sm" onClick={() => setStep(0)}>
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
