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

interface ColumnMap {
  nameCol: number;
  filterCol: number;
  filterValue: string;
  doneCol: number;
  doneValue: string;
  rowOffset: number;  // 0 = start from first matching row
  rowLimit: number;   // 0 = no limit (all rows)
  outputCols: {
    foundGym?: number;
    instagram?: number;
    facebook?: number;
    smoothcomp?: number;
    source?: number;
    reason?: number;
  };
}

interface ColumnMapperProps {
  sheetId: string;
  tabName: string;
  onLaunch: (columnMap: ColumnMap) => void;
  isLaunching: boolean;
  defaultValues?: Partial<ColumnMap>;
}

const SKIP_VALUE = "__skip__";

const OUTPUT_FIELDS = [
  { key: "foundGym" as const, label: "Found Gym Academy" },
  { key: "instagram" as const, label: "Instagram Handle" },
  { key: "facebook" as const, label: "Facebook Profile" },
  { key: "smoothcomp" as const, label: "Smoothcomp Profile" },
  { key: "source" as const, label: "Source" },
  { key: "reason" as const, label: "Reason / Notes" },
];

export function ColumnMapper({
  sheetId,
  tabName,
  onLaunch,
  isLaunching,
  defaultValues,
}: ColumnMapperProps) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nameColIdx, setNameColIdx] = useState<string>("");
  const [filterColIdx, setFilterColIdx] = useState<string>("");
  const [filterValue, setFilterValue] = useState("false");
  const [doneColIdx, setDoneColIdx] = useState<string>("");
  const [doneValue, setDoneValue] = useState("true");
  const [rowOffset, setRowOffset] = useState<string>("0");
  const [rowLimit, setRowLimit] = useState<string>("0");
  const [outputCols, setOutputCols] = useState<Record<string, string>>({});

  useEffect(() => {
    setLoading(true);
    fetch(
      `/api/sheets/headers?sheetId=${encodeURIComponent(sheetId)}&tabName=${encodeURIComponent(tabName)}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.headers) {
          setHeaders(data.headers);
          // Restore saved column mapping after headers load
          if (defaultValues) {
            if (defaultValues.nameCol !== undefined) setNameColIdx(String(defaultValues.nameCol));
            if (defaultValues.filterCol !== undefined) setFilterColIdx(String(defaultValues.filterCol));
            if (defaultValues.filterValue !== undefined) setFilterValue(defaultValues.filterValue);
            if (defaultValues.doneCol !== undefined) setDoneColIdx(String(defaultValues.doneCol));
            if (defaultValues.doneValue !== undefined) setDoneValue(defaultValues.doneValue);
            if (defaultValues.rowOffset !== undefined) setRowOffset(String(defaultValues.rowOffset));
            if (defaultValues.rowLimit !== undefined) setRowLimit(String(defaultValues.rowLimit));
            if (defaultValues.outputCols) {
              const restored: Record<string, string> = {};
              for (const [k, v] of Object.entries(defaultValues.outputCols)) {
                if (v !== undefined) restored[k] = String(v);
              }
              setOutputCols(restored);
            }
          }
        } else {
          setError(data.error ?? "Failed to load headers");
        }
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, [sheetId, tabName]); // intentionally omit defaultValues to only apply on first load

  function handleLaunch() {
    if (!nameColIdx || !filterColIdx || !doneColIdx) return;

    const outputColsMap: ColumnMap["outputCols"] = {};
    for (const field of OUTPUT_FIELDS) {
      const val = outputCols[field.key];
      if (val && val !== SKIP_VALUE) {
        outputColsMap[field.key] = parseInt(val, 10);
      }
    }

    onLaunch({
      nameCol: parseInt(nameColIdx, 10),
      filterCol: parseInt(filterColIdx, 10),
      filterValue,
      doneCol: parseInt(doneColIdx, 10),
      doneValue,
      rowOffset: Math.max(0, parseInt(rowOffset || "0", 10)),
      rowLimit: Math.max(0, parseInt(rowLimit || "0", 10)),
      outputCols: outputColsMap,
    });
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading columns...
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  const headerOptions = headers.map((h, i) => ({
    label: `${h || `Column ${i + 1}`} (col ${i + 1})`,
    value: String(i),
  }));

  const isValid = nameColIdx && filterColIdx && doneColIdx && filterValue && doneValue;

  return (
    <div className="space-y-6">
      {/* Input columns */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Input Columns
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Name Column</Label>
            <Select value={nameColIdx} onValueChange={setNameColIdx}>
              <SelectTrigger>
                <SelectValue placeholder="Attendee name column..." />
              </SelectTrigger>
              <SelectContent>
                {headerOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Filter Column</Label>
            <Select value={filterColIdx} onValueChange={setFilterColIdx}>
              <SelectTrigger>
                <SelectValue placeholder="Status/filter column..." />
              </SelectTrigger>
              <SelectContent>
                {headerOptions.map((o) => (
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
            <p className="text-xs text-muted-foreground">
              Rows where Filter Column equals this value will be processed
            </p>
          </div>

          <div className="space-y-2">
            <Label>Done Column</Label>
            <Select value={doneColIdx} onValueChange={setDoneColIdx}>
              <SelectTrigger>
                <SelectValue placeholder="Column to mark as done..." />
              </SelectTrigger>
              <SelectContent>
                {headerOptions.map((o) => (
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
            <p className="text-xs text-muted-foreground">
              Value written to Done Column on success
            </p>
          </div>
        </div>
      </div>

      {/* Row range */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Row Range
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Offset (skip first N rows)</Label>
            <Input
              type="number"
              min="0"
              value={rowOffset}
              onChange={(e) => setRowOffset(e.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              0 = start from the first matching row
            </p>
          </div>
          <div className="space-y-2">
            <Label>Limit (max rows to process)</Label>
            <Input
              type="number"
              min="0"
              value={rowLimit}
              onChange={(e) => setRowLimit(e.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              0 = no limit, process all matching rows
            </p>
          </div>
        </div>
      </div>

      {/* Output column mapping */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Output Column Mapping
        </h3>
        <p className="text-sm text-muted-foreground">
          Map each output field to a sheet column. Select &quot;— skip —&quot; to omit writing that field.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {OUTPUT_FIELDS.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label>{field.label}</Label>
              <Select
                value={outputCols[field.key] ?? SKIP_VALUE}
                onValueChange={(val) =>
                  setOutputCols((prev) => ({ ...prev, [field.key]: val }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="— skip —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SKIP_VALUE}>— skip —</SelectItem>
                  {headerOptions.map((o) => (
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
        {isLaunching ? "Launching..." : "Launch Job"}
      </Button>
    </div>
  );
}
