"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, Loader2 } from "lucide-react";

interface Team {
  id: string;
  name: string;
  slug: string;
}

export function TeamSelector() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    // Get active teamId from user_info cookie
    try {
      const match = document.cookie.match(/(?:^|;\s*)user_info=([^;]+)/);
      if (match) {
        const info = JSON.parse(decodeURIComponent(match[1]));
        setActiveTeamId(info.teamId ?? null);
      }
    } catch {
      // ignore
    }

    // Fetch user's teams
    fetch("/api/teams")
      .then((r) => r.json())
      .then((d) => setTeams(d.teams ?? []))
      .catch(() => {});
  }, []);

  if (teams.length <= 1) return null;

  const activeTeam = teams.find((t) => t.id === activeTeamId);

  async function handleSwitch(teamId: string) {
    if (teamId === activeTeamId) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    try {
      const res = await fetch("/api/auth/switch-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });
      if (res.ok) {
        setActiveTeamId(teamId);
        setOpen(false);
        router.refresh();
      }
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((s) => !s)}
        className="flex items-center gap-1.5 text-sm px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors"
      >
        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground max-w-[100px] truncate">
          {activeTeam?.name ?? "Select team"}
        </span>
        {switching ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-md border border-border bg-popover shadow-md py-1">
            {teams.map((team) => (
              <button
                key={team.id}
                onClick={() => handleSwitch(team.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left ${
                  team.id === activeTeamId ? "text-primary font-medium" : ""
                }`}
              >
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                {team.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
