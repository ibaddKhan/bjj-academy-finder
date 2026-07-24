"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Save, Eye, EyeOff, Upload, CheckCircle2 } from "lucide-react";

interface SettingsData {
  serperKey: string;
  instagramKey: string;
  facebookKey: string;
  openrouterKey: string;
  zenrowsKey: string;
  scrapingantKey: string;
  openrouterModel: string;
  enrichmentModel1: string;
  enrichmentModel2: string;
  googleServiceAccount: string;
}

const API_KEY_FIELDS: (keyof SettingsData)[] = [
  "serperKey",
  "instagramKey",
  "facebookKey",
  "openrouterKey",
  "zenrowsKey",
  "scrapingantKey",
];

const MODEL_FIELDS: (keyof SettingsData)[] = [
  "openrouterModel",
  "enrichmentModel1",
  "enrichmentModel2",
];

const FIELD_LABELS: Record<keyof SettingsData, string> = {
  serperKey: "Serper API Key (Google Search)",
  instagramKey: "RapidAPI Key (Instagram — instagram-looter2)",
  facebookKey: "RapidAPI Key (Facebook — facebook-scraper3)",
  openrouterKey: "OpenRouter API Key",
  zenrowsKey: "ZenRows API Key",
  scrapingantKey: "ScrapingAnt API Key (Website Scraping)",
  openrouterModel: "Person Finder Model",
  enrichmentModel1: "Gym Enrichment — Stage 1 Model",
  enrichmentModel2: "Gym Enrichment — Stage 2 Model",
  googleServiceAccount: "Google Service Account JSON",
};

const MODEL_PLACEHOLDERS: Record<string, string> = {
  openrouterModel: "anthropic/claude-haiku-4-5",
  enrichmentModel1: "anthropic/claude-haiku-4-5",
  enrichmentModel2: "anthropic/claude-haiku-4-5",
};

export function SettingsForm() {
  const [settings, setSettings] = useState<Partial<SettingsData>>({});
  const [serviceAccountEmail, setServiceAccountEmail] = useState<string | null>(null);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          const { googleServiceAccountEmail, ...rest } = data.settings;
          setSettings((prev) => ({ ...prev, ...rest }));
          if (googleServiceAccountEmail) {
            setServiceAccountEmail(googleServiceAccountEmail);
          }
        }
      })
      .catch(console.error);
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function handleServiceAccountUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const content = ev.target?.result as string;
        const parsed = JSON.parse(content);
        if (!parsed.client_email || !parsed.private_key) {
          throw new Error("Invalid service account JSON (missing client_email or private_key)");
        }
        setSettings((prev) => ({ ...prev, googleServiceAccount: content }));
        setServiceAccountEmail(parsed.client_email);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invalid JSON file");
      }
    };
    reader.readAsText(file);
  }

  function toggleShow(key: string) {
    setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Google Service Account */}
      <Card>
        <CardHeader>
          <CardTitle>Google Service Account</CardTitle>
          <CardDescription>
            Upload a Google service account JSON key. Share your spreadsheets with
            the service account email below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {serviceAccountEmail && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-green-500/10 border border-green-500/20">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Service account configured</p>
                <p className="text-sm font-mono truncate">{serviceAccountEmail}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Share your Google Sheets with this email to grant access.
                </p>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>Upload JSON Key File</Label>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 px-4 py-2 border border-border rounded-md cursor-pointer hover:bg-muted/50 transition-colors text-sm">
                <Upload className="h-4 w-4" />
                {serviceAccountEmail ? "Replace key file" : "Upload key file"}
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleServiceAccountUpload}
                />
              </label>
              {settings.googleServiceAccount && (
                <span className="text-sm text-green-500">Ready to save ✓</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>
            Keys are AES-256 encrypted at rest. Showing masked values for existing keys.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {API_KEY_FIELDS.map((key) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key}>{FIELD_LABELS[key]}</Label>
              <div className="relative">
                <Input
                  id={key}
                  type={showKeys[key] ? "text" : "password"}
                  value={settings[key] ?? ""}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  placeholder="Enter key to update..."
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => toggleShow(key)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKeys[key] ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Model Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>AI Model Configuration</CardTitle>
          <CardDescription>
            OpenRouter model IDs for each pipeline stage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {MODEL_FIELDS.map((key) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key}>{FIELD_LABELS[key]}</Label>
              <Input
                id={key}
                type="text"
                value={settings[key] ?? ""}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, [key]: e.target.value }))
                }
                placeholder={MODEL_PLACEHOLDERS[key] ?? "anthropic/claude-haiku-4-5"}
              />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Any OpenRouter model ID, e.g.{" "}
            <code className="bg-muted px-1 rounded">anthropic/claude-haiku-4-5</code>,{" "}
            <code className="bg-muted px-1 rounded">openai/gpt-4o-mini</code>
          </p>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={saving}>
        <Save className="h-4 w-4 mr-2" />
        {saving ? "Saving..." : saved ? "Saved!" : "Save Settings"}
      </Button>
    </form>
  );
}
