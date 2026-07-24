"use client";

import { useState } from "react";
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
import { Loader2, Link2 } from "lucide-react";

interface Tab {
  id: string;
  title: string;
}

interface DestinationSheetConnectorProps {
  sourceSheetUrl: string;
  onConnected: (data: {
    sheetUrl: string;
    sheetId: string;
    tabId: string;
    tabName: string;
  }) => void;
}

export function DestinationSheetConnector({
  sourceSheetUrl,
  onConnected,
}: DestinationSheetConnectorProps) {
  const [useSameSheet, setUseSameSheet] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [sheetId, setSheetId] = useState("");
  const [selectedTab, setSelectedTab] = useState<Tab | null>(null);

  async function handleConnect(url: string) {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setTabs([]);
    setSelectedTab(null);

    try {
      const res = await fetch(
        `/api/sheets/tabs?url=${encodeURIComponent(url.trim())}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to connect");
      setTabs(data.tabs);
      setSheetId(data.sheetId);
      if (data.tabs.length === 1) setSelectedTab(data.tabs[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  }

  function handleSameSheetToggle(checked: boolean) {
    setUseSameSheet(checked);
    if (checked) {
      handleConnect(sourceSheetUrl);
      setSheetUrl(sourceSheetUrl);
    } else {
      setSheetUrl("");
      setTabs([]);
      setSheetId("");
      setSelectedTab(null);
    }
  }

  function handleContinue() {
    if (!selectedTab || !sheetId) return;
    const url = useSameSheet ? sourceSheetUrl : sheetUrl.trim();
    onConnected({
      sheetUrl: url,
      sheetId,
      tabId: selectedTab.id,
      tabName: selectedTab.title,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="sameSheet"
          checked={useSameSheet}
          onChange={(e) => handleSameSheetToggle(e.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        <Label htmlFor="sameSheet" className="cursor-pointer">
          Use same sheet as source
        </Label>
      </div>

      {!useSameSheet && (
        <div className="space-y-2">
          <Label htmlFor="destUrl">Destination Sheet URL</Label>
          <div className="flex gap-2">
            <Input
              id="destUrl"
              type="url"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleConnect(sheetUrl)}
            />
            <Button
              type="button"
              onClick={() => handleConnect(sheetUrl)}
              disabled={loading || !sheetUrl.trim()}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              <span className="ml-2">Connect</span>
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}

      {tabs.length > 0 && (
        <div className="space-y-2">
          <Label>Select Tab / Sheet</Label>
          <Select
            value={selectedTab?.id ?? ""}
            onValueChange={(tabId) => {
              const tab = tabs.find((t) => t.id === tabId);
              if (tab) setSelectedTab(tab);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a tab..." />
            </SelectTrigger>
            <SelectContent>
              {tabs.map((tab) => (
                <SelectItem key={tab.id} value={tab.id}>
                  {tab.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {selectedTab && (
        <Button onClick={handleContinue} className="w-full">
          Continue with &quot;{selectedTab.title}&quot;
        </Button>
      )}
    </div>
  );
}
