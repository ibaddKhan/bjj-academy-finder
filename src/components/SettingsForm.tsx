"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
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
import { Badge } from "@/components/ui/badge";
import { Save, Eye, EyeOff, CheckCircle2, LinkIcon, Unlink } from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  username: string;
  role: string;
}

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
};

const MODEL_PLACEHOLDERS: Record<string, string> = {
  openrouterModel: "anthropic/claude-haiku-4-5",
  enrichmentModel1: "anthropic/claude-haiku-4-5",
  enrichmentModel2: "anthropic/claude-haiku-4-5",
};

export function SettingsForm() {
  const searchParams = useSearchParams();
  const [settings, setSettings] = useState<Partial<SettingsData>>({});
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  const googleStatus = searchParams.get("google");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          const { googleOAuthEmail, ...rest } = data.settings;
          setSettings((prev) => ({ ...prev, ...rest }));
          if (googleOAuthEmail) {
            setGoogleEmail(googleOAuthEmail);
          }
        }
      })
      .catch(console.error);

    fetch("/api/teams/members")
      .then((r) => r.json())
      .then((data) => setTeamMembers(data.members ?? []))
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

  async function handleDisconnectGoogle() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/auth/google/disconnect", { method: "DELETE" });
      if (res.ok) {
        setGoogleEmail(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setDisconnecting(false);
    }
  }

  function toggleShow(key: string) {
    setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Google Sheets Connection */}
      <Card>
        <CardHeader>
          <CardTitle>Google Sheets</CardTitle>
          <CardDescription>
            Connect your Google account to allow reading and writing Google Sheets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {googleStatus === "connected" && !googleEmail && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-green-500/10 border border-green-500/20">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              <p className="text-sm text-green-500">Google account connected successfully!</p>
            </div>
          )}
          {googleStatus === "error" && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">
                Failed to connect Google account. Please try again.
              </p>
            </div>
          )}

          {googleEmail ? (
            <div className="flex items-center justify-between gap-4 p-3 rounded-md bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Connected as</p>
                  <p className="text-sm font-mono truncate">{googleEmail}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDisconnectGoogle}
                disabled={disconnecting}
              >
                <Unlink className="h-4 w-4 mr-1" />
                {disconnecting ? "Disconnecting..." : "Disconnect"}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                window.location.href = "/api/auth/google/connect";
              }}
            >
              <LinkIcon className="h-4 w-4 mr-2" />
              Connect with Google
            </Button>
          )}
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

      {/* Team Members */}
      {teamMembers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              Everyone on your active team.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {teamMembers.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{m.name}</p>
                    <p className="text-xs text-muted-foreground">@{m.username}</p>
                  </div>
                  <Badge variant={m.role === "super_admin" ? "default" : "secondary"}>
                    {m.role}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={saving}>
        <Save className="h-4 w-4 mr-2" />
        {saving ? "Saving..." : saved ? "Saved!" : "Save Settings"}
      </Button>
    </form>
  );
}
