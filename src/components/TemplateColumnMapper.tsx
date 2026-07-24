"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Play } from "lucide-react";

// Template input/output field definitions (client-side, matches registry)
const GYM_ENRICHMENT_FIELDS = {
  inputFields: [
    { key: "gymName", label: "Gym / Academy Name" },
    { key: "location", label: "Location (City, State)" },
  ],
  sourceOutputFields: [
    { key: "status", label: "Enrichment Status" },
    { key: "aiOwner", label: "AI Owner" },
    { key: "aiCoach", label: "AI Coach" },
  ],
};

const TEMPLATE_FIELDS: Record<string, typeof GYM_ENRICHMENT_FIELDS> = {
  gym_enrichment: GYM_ENRICHMENT_FIELDS,
};

interface TemplateColumnMapperProps {
  templateSlug: string;
  sourceSheetId: string;
  sourceTabName: string;
  onLaunch: (columnMap: object) => void;
  isLaunching: boolean;
}

const SKIP = "__skip__";

export function TemplateColumnMapper({
  templateSlug,
  sourceSheetId,
  sourceTabName,
  onLaunch,
  isLaunching,
}: TemplateColumnMapperProps) {
  const fields = TEMPLATE_FIELDS[templateSlug];
  const [sourceHeaders, setSourceHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Input column mapping (from source sheet)
  const [inputCols, setInputCols] = useState<Record<string, string>>({});
  // Filter/done columns
  const [filterColIdx, setFilterColIdx] = useState("");
  const [filterValue, setFilterValue] = useState("false");
  const [doneColIdx, setDoneColIdx] = useState("");
  const [doneValue, setDoneValue] = useState("true");
  const [rowOffset, setRowOffset] = useState("0");
  const [rowLimit, setRowLimit] = useState("0");
  // Source output columns
  const [sourceOutputCols, setSourceOutputCols] = useState<Record<string, string>>({});

  useEffect(() => {
    setLoading(true);
    fetch(
      `/api/sheets/headers?sheetId=${encodeURIComponent(sourceSheetId)}&tabName=${encodeURIComponent(sourceTabName)}`
    )
      .then((r) => r.json())
      .then((data) => {
        setSourceHeaders(data.headers ?? []);
      })
      .catch(() => setError("Failed to load sheet headers"))
      .finally(() => setLoading(false));
  }, [sourceSheetId, sourceTabName]);

  if (!fields) {
    return <p className="text-sm text-destructive">Unknown template: {templateSlug}</p>;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading columns...
      </div>
    );
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;

  const srcOptions = sourceHeaders.map((h, i) => ({
    label: `${h || `Column ${i + 1}`} (col ${i + 1})`,
    value: String(i),
  }));

  const isValid =
    fields.inputFields.every((f) => inputCols[f.key]) &&
    filterColIdx &&
    doneColIdx;

  function handleLaunch() {
    if (!isValid) return;

    const inputColsMap: Record<string, number> = {};
    for (const f of fields.inputFields) {
      if (inputCols[f.key]) inputColsMap[f.key] = parseInt(inputCols[f.key], 10);
    }

    const srcOutMap: Record<string, number> = {};
    for (const f of fields.sourceOutputFields) {
      const val = sourceOutputCols[f.key];
      if (val && val !== SKIP) srcOutMap[f.key] = parseInt(val, 10);
    }

    onLaunch({
      inputCols: inputColsMap,
      filterCol: parseInt(filterColIdx, 10),
      filterValue,
      doneCol: parseInt(doneColIdx, 10),
      doneValue,
      rowOffset: Math.max(0, parseInt(rowOffset || "0", 10)),
      rowLimit: Math.max(0, parseInt(rowLimit || "0", 10)),
      sourceOutputCols: srcOutMap,
    });
  }

  return (
    <div className="space-y-6">
      {/* Input columns from source sheet */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Input Columns (Source Sheet)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.inputFields.map((f) => (
            <div key={f.key} className="space-y-2">
              <Label>{f.label} *</Label>
              <Select
                value={inputCols[f.key] ?? ""}
                onValueChange={(val) =>
                  setInputCols((prev) => ({ ...prev, [f.key]: val }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select column..." />
                </SelectTrigger>
                <SelectContent>
                  {srcOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>

      {/* Filter / Done */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Filter & Status (Source Sheet)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Filter Column *</Label>
            <Select value={filterColIdx} onValueChange={setFilterColIdx}>
              <SelectTrigger>
                <SelectValue placeholder="Select column..." />
              </SelectTrigger>
              <SelectContent>
                {srcOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Filter Value (unprocessed)</Label>
            <Input
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              placeholder="false"
            />
          </div>
          <div className="space-y-2">
            <Label>Done Column *</Label>
            <Select value={doneColIdx} onValueChange={setDoneColIdx}>
              <SelectTrigger>
                <SelectValue placeholder="Select column..." />
              </SelectTrigger>
              <SelectContent>
                {srcOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Done Value</Label>
            <Input
              value={doneValue}
              onChange={(e) => setDoneValue(e.target.value)}
              placeholder="true"
            />
          </div>
          <div className="space-y-2">
            <Label>Row Offset</Label>
            <Input
              type="number"
              min="0"
              value={rowOffset}
              onChange={(e) => setRowOffset(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label>Row Limit</Label>
            <Input
              type="number"
              min="0"
              value={rowLimit}
              onChange={(e) => setRowLimit(e.target.value)}
              placeholder="0 = all"
            />
          </div>
        </div>
      </div>

      {/* Source output columns (written back to source sheet) */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Write Back to Source Sheet
        </h3>
        <p className="text-sm text-muted-foreground">
          Optional: columns to update in the source sheet after enrichment.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.sourceOutputFields.map((f) => (
            <div key={f.key} className="space-y-2">
              <Label>{f.label}</Label>
              <Select
                value={sourceOutputCols[f.key] ?? SKIP}
                onValueChange={(val) =>
                  setSourceOutputCols((prev) => ({ ...prev, [f.key]: val }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="— skip —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SKIP}>— skip —</SelectItem>
                  {srcOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>

      <Button
        onClick={handleLaunch}
        disabled={!isValid || isLaunching}
        size="lg"
        className="w-full"
      >
        {isLaunching ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Play className="h-4 w-4 mr-2" />
        )}
        {isLaunching ? "Launching..." : "Launch Enrichment Job"}
      </Button>
    </div>
  );
}
