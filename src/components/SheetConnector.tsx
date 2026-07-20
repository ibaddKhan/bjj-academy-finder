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

interface SheetConnectorProps {
  onConnected: (data: {
    sheetUrl: string;
    sheetId: string;
    tabId: string;
    tabName: string;
  }) => void;
}

export function SheetConnector({ onConnected }: SheetConnectorProps) {
  const [sheetUrl, setSheetUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [sheetId, setSheetId] = useState("");
  const [selectedTab, setSelectedTab] = useState<Tab | null>(null);

  async function handleConnect() {
    if (!sheetUrl.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/sheets/tabs?url=${encodeURIComponent(sheetUrl.trim())}`
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to connect");
      }

      setTabs(data.tabs);
      setSheetId(data.sheetId);

      if (data.tabs.length === 1) {
        setSelectedTab(data.tabs[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  }

  function handleTabSelect(tabId: string) {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) setSelectedTab(tab);
  }

  function handleContinue() {
    if (!selectedTab || !sheetId) return;
    onConnected({
      sheetUrl: sheetUrl.trim(),
      sheetId,
      tabId: selectedTab.id,
      tabName: selectedTab.title,
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="sheetUrl">Google Sheet URL</Label>
        <div className="flex gap-2">
          <Input
            id="sheetUrl"
            type="url"
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleConnect()}
          />
          <Button onClick={handleConnect} disabled={loading || !sheetUrl.trim()}>
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

      {tabs.length > 0 && (
        <div className="space-y-2">
          <Label>Select Tab / Sheet</Label>
          <Select
            value={selectedTab?.id ?? ""}
            onValueChange={handleTabSelect}
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
