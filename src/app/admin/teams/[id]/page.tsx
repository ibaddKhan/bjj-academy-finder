"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, UserPlus, Trash2 } from "lucide-react";

interface Member {
  id: string;
  userId: string;
  user: { id: string; name: string; username: string; role: string };
}

interface Team {
  id: string;
  name: string;
  slug: string;
}

interface AllUser {
  id: string;
  name: string;
  username: string;
}

export default function TeamDetailPage({ params }: { params: { id: string } }) {
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [allUsers, setAllUsers] = useState<AllUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/teams`).then((r) => r.json()),
      fetch(`/api/admin/users`).then((r) => r.json()),
    ]).then(([teamsData, usersData]) => {
      const t = (teamsData.teams ?? []).find((t: Team) => t.id === params.id);
      setTeam(t ?? null);
      setAllUsers(usersData.users ?? []);
      setLoading(false);
    });

    // Load team members via teams API response
    fetch(`/api/admin/teams`)
      .then((r) => r.json())
      .then(() => {
        // We don't have a members endpoint directly, use users API
        fetch(`/api/admin/users`)
          .then((r) => r.json())
          .then((d) => {
            const teamMembers: Member[] = [];
            for (const u of d.users ?? []) {
              for (const tm of u.teams ?? []) {
                if (tm.teamId === params.id) {
                  teamMembers.push({
                    id: tm.id,
                    userId: u.id,
                    user: u,
                  });
                }
              }
            }
            setMembers(teamMembers);
          });
      });
  }, [params.id]);

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/teams/${params.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      const user = allUsers.find((u) => u.id === selectedUserId);
      if (user) {
        setMembers((prev) => [
          ...prev,
          { id: data.member.id, userId: user.id, user: { ...user, role: "member" } },
        ]);
      }
      setSelectedUserId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!confirm("Remove this member?")) return;
    await fetch(`/api/admin/teams/${params.id}/members?userId=${userId}`, {
      method: "DELETE",
    });
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
  }

  const nonMembers = allUsers.filter(
    (u) => !members.some((m) => m.userId === u.id)
  );

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <p className="text-muted-foreground text-sm">
            <a href="/admin" className="hover:underline">Admin</a> /{" "}
            <a href="/admin/teams" className="hover:underline">Teams</a> / {team?.name ?? "..."}
          </p>
          <h1 className="text-2xl font-bold mt-1">{team?.name ?? "Loading..."}</h1>
          {team && <p className="text-muted-foreground text-sm">/{team.slug}</p>}
        </div>

        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Members ({members.length})</CardTitle>
                <CardDescription>Users with access to this team&apos;s jobs and settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {members.length === 0 && (
                  <p className="text-sm text-muted-foreground">No members yet.</p>
                )}
                {members.map((m) => (
                  <div key={m.userId} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{m.user.name}</p>
                      <p className="text-xs text-muted-foreground">@{m.user.username}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRemoveMember(m.userId)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                {nonMembers.length > 0 && (
                  <form onSubmit={handleAddMember} className="flex gap-2 pt-2 border-t border-border">
                    <div className="flex-1">
                      <Label className="sr-only">Add Member</Label>
                      <select
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                      >
                        <option value="">Select user to add...</option>
                        {nonMembers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} (@{u.username})
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button type="submit" size="sm" disabled={!selectedUserId || adding}>
                      {adding ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserPlus className="h-4 w-4" />
                      )}
                      <span className="ml-1">Add</span>
                    </Button>
                  </form>
                )}
                {error && <p className="text-sm text-destructive">{error}</p>}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
