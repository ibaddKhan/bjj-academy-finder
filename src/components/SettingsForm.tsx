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
import {
  IndustryConfig,
  INDUSTRY_PRESETS,
  INDUSTRY_PRESET_OPTIONS,
  getIndustryPreset,
  DEFAULT_INDUSTRY_SLUG,
} from "@/lib/industries";

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

interface TeamMember {
  id: string;
  name: string;
  username: string;
  role: string;
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
  enrichmentModel1: "Enrichment — Stage 1 Model",
  enrichmentModel2: "Enrichment — Stage 2 Model",
};

const MODEL_PLACEHOLDERS: Record<string, string> = {
  openrouterModel: "anthropic/claude-haiku-4-5",
  enrichmentModel1: "anthropic/claude-haiku-4-5",
  enrichmentModel2: "anthropic/claude-haiku-4-5",
};

const TABS = ["API & Models", "Industry", "Team Members"] as const;
type Tab = (typeof TABS)[number];

export function SettingsForm() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>("API & Models");

  // ── API & Models state ─────────────────────────────────────────────────────
  const [settings, setSettings] = useState<Partial<SettingsData>>({});
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // ── Industry state ─────────────────────────────────────────────────────────
  const [industryConfig, setIndustryConfig] = useState<IndustryConfig>(
    getIndustryPreset(DEFAULT_INDUSTRY_SLUG)
  );
  const [industrySaving, setIndustrySaving] = useState(false);
  const [industrySaved, setIndustrySaved] = useState(false);
  const [industryError, setIndustryError] = useState<string | null>(null);

  // ── Team members state ─────────────────────────────────────────────────────
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  const googleStatus = searchParams.get("google");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          const { googleOAuthEmail, ...rest } = data.settings;
          setSettings((prev) => ({ ...prev, ...rest }));
          if (googleOAuthEmail) setGoogleEmail(googleOAuthEmail);
        }
      })
      .catch(console.error);

    fetch("/api/settings/industry")
      .then((r) => r.json())
      .then((data) => { if (data.config) setIndustryConfig(data.config); })
      .catch(console.error);

    fetch("/api/teams/members")
      .then((r) => r.json())
      .then((data) => setTeamMembers(data.members ?? []))
      .catch(console.error);
  }, []);

  // ── API & Models handlers ──────────────────────────────────────────────────
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
      if (res.ok) setGoogleEmail(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setDisconnecting(false);
    }
  }

  function toggleShow(key: string) {
    setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // ── Industry handlers ──────────────────────────────────────────────────────
  function loadPreset(slug: string) {
    setIndustryConfig(getIndustryPreset(slug));
  }

  function updateIndustry(field: keyof IndustryConfig, value: string) {
    setIndustryConfig((prev) => ({ ...prev, [field]: value }));
  }

  async function handleIndustrySave() {
    setIndustrySaving(true);
    setIndustryError(null);
    try {
      const res = await fetch("/api/settings/industry", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(industryConfig),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save");
      }
      setIndustrySaved(true);
      setTimeout(() => setIndustrySaved(false), 3000);
    } catch (err) {
      setIndustryError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIndustrySaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <div className="flex border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Tab 1: API & Models ─────────────────────────────────────────────── */}
      {activeTab === "API & Models" && (
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
                  onClick={() => { window.location.href = "/api/auth/google/connect"; }}
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
                      {showKeys[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
      )}

      {/* ── Tab 2: Industry ─────────────────────────────────────────────────── */}
      {activeTab === "Industry" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Industry Configuration</CardTitle>
              <CardDescription>
                Select a preset to auto-fill all fields, then customise any value and save.
                All jobs will use these keywords and prompts by default.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Preset selector */}
              <div className="flex gap-3 items-end">
                <div className="flex-1 space-y-2">
                  <Label>Load Preset</Label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={industryConfig.slug}
                    onChange={(e) => loadPreset(e.target.value)}
                  >
                    {INDUSTRY_PRESET_OPTIONS.map((o) => (
                      <option key={o.slug} value={o.slug}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <Button type="button" variant="outline" onClick={() => loadPreset(industryConfig.slug)}>
                  Reset to Preset
                </Button>
              </div>

              <div className="border-t border-border pt-5 space-y-4">
                {/* Label + Entity Label */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Industry Label</Label>
                    <Input
                      value={industryConfig.label}
                      onChange={(e) => updateIndustry("label", e.target.value)}
                      placeholder="e.g. BJJ Gyms"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Entity Label <span className="text-muted-foreground text-xs">(short)</span></Label>
                    <Input
                      value={industryConfig.entityLabel}
                      onChange={(e) => updateIndustry("entityLabel", e.target.value)}
                      placeholder="e.g. Gym/Academy"
                    />
                  </div>
                </div>

                {/* Search Keyword + Context Keywords */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Search Keyword <span className="text-muted-foreground text-xs">(added to Serper queries)</span></Label>
                    <Input
                      value={industryConfig.searchKeyword}
                      onChange={(e) => updateIndustry("searchKeyword", e.target.value)}
                      placeholder="e.g. BJJ"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Context Keywords <span className="text-muted-foreground text-xs">(for AI verification)</span></Label>
                    <Input
                      value={industryConfig.contextKeywords}
                      onChange={(e) => updateIndustry("contextKeywords", e.target.value)}
                      placeholder="e.g. BJJ/jiu-jitsu/grappling/MMA"
                    />
                  </div>
                </div>

                {/* Entity Type */}
                <div className="space-y-2">
                  <Label>Entity Type <span className="text-muted-foreground text-xs">(full description for AI)</span></Label>
                  <Input
                    value={industryConfig.entityType}
                    onChange={(e) => updateIndustry("entityType", e.target.value)}
                    placeholder="e.g. BJJ gym/academy"
                  />
                </div>

                {/* Person Finder Instructions */}
                <div className="space-y-2">
                  <Label>Person Finder — AI Instructions</Label>
                  <p className="text-xs text-muted-foreground">
                    Instructions for the AI that verifies a person&apos;s current employer/gym from social profiles.
                  </p>
                  <textarea
                    className="w-full min-h-[140px] rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono resize-y"
                    value={industryConfig.personFinderSystemPrompt}
                    onChange={(e) => updateIndustry("personFinderSystemPrompt", e.target.value)}
                  />
                </div>

                {/* Stage 1 Instructions */}
                <div className="space-y-2">
                  <Label>Enrichment Stage 1 — AI Instructions</Label>
                  <p className="text-xs text-muted-foreground">
                    Instructions for link discovery: finding the official website, social pages, and directory listings.
                  </p>
                  <textarea
                    className="w-full min-h-[120px] rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono resize-y"
                    value={industryConfig.stage1SystemPrompt}
                    onChange={(e) => updateIndustry("stage1SystemPrompt", e.target.value)}
                  />
                </div>

                {/* Stage 2 Instructions */}
                <div className="space-y-2">
                  <Label>Enrichment Stage 2 — AI Instructions</Label>
                  <p className="text-xs text-muted-foreground">
                    Instructions for data extraction: pulling structured info from scraped content.
                  </p>
                  <textarea
                    className="w-full min-h-[120px] rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono resize-y"
                    value={industryConfig.stage2SystemPrompt}
                    onChange={(e) => updateIndustry("stage2SystemPrompt", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {industryError && <p className="text-sm text-destructive">{industryError}</p>}
          <Button type="button" onClick={handleIndustrySave} disabled={industrySaving}>
            <Save className="h-4 w-4 mr-2" />
            {industrySaving ? "Saving..." : industrySaved ? "Saved!" : "Save Industry Settings"}
          </Button>
        </div>
      )}

      {/* ── Tab 3: Team Members ─────────────────────────────────────────────── */}
      {activeTab === "Team Members" && (
        <div className="space-y-4">
          {teamMembers.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                No members found on your current team.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>Everyone on your active team.</CardDescription>
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
        </div>
      )}
    </div>
  );
}
