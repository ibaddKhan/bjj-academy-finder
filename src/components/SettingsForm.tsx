"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Eye, EyeOff } from "lucide-react";

interface SettingsData {
  serperKey: string;
  rapidapiKey: string;
  openrouterKey: string;
  zenrowsKey: string;
  openrouterModel: string;
}

const FIELD_LABELS: Record<keyof SettingsData, string> = {
  serperKey: "Serper API Key",
  rapidapiKey: "RapidAPI Key (Instagram + Facebook)",
  openrouterKey: "OpenRouter API Key",
  zenrowsKey: "ZenRows API Key",
  openrouterModel: "OpenRouter Model",
};

const FIELD_PLACEHOLDERS: Record<keyof SettingsData, string> = {
  serperKey: "Enter Serper API key...",
  rapidapiKey: "Enter RapidAPI key...",
  openrouterKey: "Enter OpenRouter API key...",
  zenrowsKey: "Enter ZenRows API key...",
  openrouterModel: "anthropic/claude-haiku-4-5",
};

const API_KEYS: (keyof SettingsData)[] = [
  "serperKey",
  "rapidapiKey",
  "openrouterKey",
  "zenrowsKey",
];

export function SettingsForm() {
  const [settings, setSettings] = useState<SettingsData>({
    serperKey: "",
    rapidapiKey: "",
    openrouterKey: "",
    zenrowsKey: "",
    openrouterModel: "anthropic/claude-haiku-4-5",
  });
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          setSettings((prev) => ({ ...prev, ...data.settings }));
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

  function toggleShow(key: string) {
    setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <form onSubmit={handleSave}>
      <Card>
        <CardHeader>
          <CardTitle>API Configuration</CardTitle>
          <CardDescription>
            Configure the API keys used to power the BJJ gym finder. Keys are
            encrypted at rest.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* API Keys */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              API Keys
            </h3>
            {API_KEYS.map((key) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={key}>{FIELD_LABELS[key]}</Label>
                <div className="relative">
                  <Input
                    id={key}
                    type={showKeys[key] ? "text" : "password"}
                    value={settings[key]}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    placeholder={FIELD_PLACEHOLDERS[key]}
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
          </div>

          {/* Model config */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Model Configuration
            </h3>
            <div className="space-y-2">
              <Label htmlFor="openrouterModel">{FIELD_LABELS.openrouterModel}</Label>
              <Input
                id="openrouterModel"
                type="text"
                value={settings.openrouterModel}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    openrouterModel: e.target.value,
                  }))
                }
                placeholder={FIELD_PLACEHOLDERS.openrouterModel}
              />
              <p className="text-xs text-muted-foreground">
                Any OpenRouter model ID, e.g.{" "}
                <code className="bg-muted px-1 rounded">anthropic/claude-haiku-4-5</code>,{" "}
                <code className="bg-muted px-1 rounded">openai/gpt-4o-mini</code>
              </p>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : saved ? "Saved!" : "Save Settings"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
