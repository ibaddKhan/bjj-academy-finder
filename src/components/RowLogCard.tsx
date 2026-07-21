"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  Search,
  Instagram,
  Facebook,
  Globe,
  CheckCircle2,
  XCircle,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ToolLogEntry {
  type: "tool_call" | "tool_result";
  tool: string;
  input?: unknown;
  output?: unknown;
  timestamp: number;
}

interface AgentResult {
  foundGym: string | null;
  instagram: string | null;
  facebook: string | null;
  smoothcomp: string | null;
  source: string | null;
  reason: string;
}

interface RowLogCardProps {
  rowId: string;
  rowIndex: number;
  attendeeName: string;
  status: "pending" | "running" | "success" | "error" | "skipped";
  result?: AgentResult | null;
  error?: string | null;
  toolLog?: ToolLogEntry[];
  attempts?: number;
  onRetry?: (rowId: string) => void;
  isLive?: boolean;
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
  search: <Search className="h-3.5 w-3.5" />,
  instagram: <Instagram className="h-3.5 w-3.5" />,
  facebook: <Facebook className="h-3.5 w-3.5" />,
  smoothcomp: <Globe className="h-3.5 w-3.5" />,
};

const STATUS_CONFIG = {
  pending: { label: "Pending", color: "secondary" as const, icon: null },
  running: {
    label: "Running",
    color: "default" as const,
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  },
  success: {
    label: "Success",
    color: "success" as const,
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  error: {
    label: "Error",
    color: "destructive" as const,
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
  skipped: { label: "Skipped", color: "outline" as const, icon: null },
};

export function RowLogCard({
  rowId,
  attendeeName,
  status,
  result,
  error,
  toolLog = [],
  attempts = 0,
  onRetry,
  isLive = false,
}: RowLogCardProps) {
  const [expanded, setExpanded] = useState(status === "running");
  const cfg = STATUS_CONFIG[status];

  // Pair tool_call + tool_result entries
  const pairedLog: Array<{ call: ToolLogEntry; result?: ToolLogEntry }> = [];
  let i = 0;
  while (i < toolLog.length) {
    if (toolLog[i].type === "tool_call") {
      const call = toolLog[i];
      const next = toolLog[i + 1];
      if (next?.type === "tool_result") {
        pairedLog.push({ call, result: next });
        i += 2;
      } else {
        pairedLog.push({ call });
        i++;
      }
    } else {
      i++;
    }
  }

  return (
    <div
      className={cn(
        "border rounded-lg overflow-hidden transition-colors",
        status === "running" && "border-primary/50 bg-primary/5",
        status === "success" && "border-green-600/30",
        status === "error" && "border-destructive/30",
        status === "pending" && "border-border opacity-60",
      )}
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/30 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}

        <span className="font-medium text-sm flex-1 truncate">{attendeeName}</span>

        {attempts > 1 && (
          <span className="text-xs text-muted-foreground">
            attempt {attempts}
          </span>
        )}

        <Badge
          variant={cfg.color}
          className="flex items-center gap-1 shrink-0"
        >
          {cfg.icon}
          {cfg.label}
        </Badge>
      </button>

      {/* Quick result line */}
      {status === "success" && result?.foundGym && !expanded && (
        <div className="px-4 pb-3 text-sm text-muted-foreground">
          <span className="text-green-400 font-medium">{result.foundGym}</span>
          {result.source && (
            <span className="ml-2 text-xs">via {result.source}</span>
          )}
        </div>
      )}

      {status === "error" && !expanded && error && (
        <div className="px-4 pb-3 text-sm text-destructive truncate">{error}</div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border/50 px-4 py-3 space-y-3">
          {/* Tool call timeline */}
          {pairedLog.length > 0 && (
            <div className="space-y-2">
              {pairedLog.map((pair, idx) => (
                <div key={idx} className="space-y-1">
                  {/* Tool call */}
                  <div className="flex items-start gap-2 text-xs">
                    <span className="text-primary shrink-0 mt-0.5">
                      {TOOL_ICONS[pair.call.tool] ?? <Globe className="h-3.5 w-3.5" />}
                    </span>
                    <div className="min-w-0">
                      <span className="font-medium text-primary">
                        {pair.call.tool}
                      </span>
                      {!!pair.call.input && (
                        <span className="text-muted-foreground ml-1">
                          {typeof pair.call.input === "object"
                            ? Object.values(pair.call.input as Record<string, string>)
                                .filter(Boolean)
                                .join(" · ")
                            : String(pair.call.input)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tool result */}
                  {pair.result && (
                    <div className="ml-5 text-xs text-muted-foreground bg-muted/40 rounded p-2 max-h-32 overflow-y-auto font-mono whitespace-pre-wrap break-words">
                      {typeof pair.result.output === "string"
                        ? pair.result.output.slice(0, 600) +
                          (pair.result.output.length > 600 ? "…" : "")
                        : JSON.stringify(pair.result.output)}
                    </div>
                  )}
                </div>
              ))}

              {/* Live indicator */}
              {isLive && status === "running" && (
                <div className="flex items-center gap-1.5 text-xs text-primary">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Searching...
                </div>
              )}
            </div>
          )}

          {/* Final result */}
          {status === "success" && result && (
            <div className="border-t border-border/40 pt-3 space-y-1.5">
              {result.foundGym && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Gym: </span>
                  <span className="font-medium text-green-400">{result.foundGym}</span>
                </p>
              )}
              {result.source && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Source: </span>
                  {result.source}
                </p>
              )}
              {result.instagram && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Instagram: </span>
                  {result.instagram}
                </p>
              )}
              {result.facebook && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Facebook: </span>
                  {result.facebook}
                </p>
              )}
              {result.smoothcomp && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Smoothcomp: </span>
                  {result.smoothcomp}
                </p>
              )}
              {result.reason && (
                <p className="text-xs text-muted-foreground italic">{result.reason}</p>
              )}
            </div>
          )}

          {/* Error + retry */}
          {status === "error" && (
            <div className="border-t border-border/40 pt-3 space-y-2">
              <p className="text-sm text-destructive">{error}</p>
              {attempts >= 5 && (
                <p className="text-xs text-muted-foreground">
                  Failed after {attempts} attempts.
                </p>
              )}
              {onRetry && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRetry(rowId)}
                  className="h-7 text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Retry this row
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
