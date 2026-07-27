"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Eye, EyeOff } from "lucide-react";

interface Team {
  id: string;
  name: string;
  slug: string;
}

interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  createdAt: string;
  teams: Array<{ teamId: string; team: { id: string; name: string; slug: string } }>;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", name: "", role: "member", teamId: "" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/admin/teams").then((r) => r.json()),
    ]).then(([userData, teamData]) => {
      setUsers(userData.users ?? []);
      setTeams(teamData.teams ?? []);
    }).finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.username, password: form.password, name: form.name, role: form.role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");

      const newUser = data.user;
      let assignedTeam: Team | undefined;

      // Assign to team if selected
      if (form.teamId) {
        const memberRes = await fetch(`/api/admin/teams/${form.teamId}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: newUser.id }),
        });
        if (memberRes.ok) {
          assignedTeam = teams.find((t) => t.id === form.teamId);
        }
      }

      const userWithTeam: User = {
        ...newUser,
        teams: assignedTeam
          ? [{ teamId: assignedTeam.id, team: assignedTeam }]
          : [],
      };

      setUsers((prev) => [userWithTeam, ...prev]);
      setForm({ username: "", password: "", name: "", role: "member", teamId: "" });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Users</h1>
            <p className="text-muted-foreground text-sm mt-1">
              <a href="/admin" className="hover:underline">Admin</a> / Users
            </p>
          </div>
          <Button onClick={() => setShowForm((s) => !s)}>
            <Plus className="h-4 w-4 mr-2" />
            New User
          </Button>
        </div>

        {showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Create User</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="John Smith"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input
                      value={form.username}
                      onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase() }))}
                      placeholder="johnsmith"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={form.password}
                        onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                        placeholder="Min 8 characters"
                        required
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <select
                      value={form.role}
                      onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                      className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    >
                      <option value="member">Member</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Assign to Team <span className="text-muted-foreground">(optional)</span></Label>
                    <select
                      value={form.teamId}
                      onChange={(e) => setForm((f) => ({ ...f, teamId: e.target.value }))}
                      className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    >
                      <option value="">— No team —</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-2">
                  <Button type="submit" disabled={creating}>
                    {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Create User
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : users.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No users yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <Card key={u.id}>
                <CardContent className="py-3 px-5">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{u.name}</p>
                      <p className="text-xs text-muted-foreground">@{u.username}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={u.role === "super_admin" ? "default" : "secondary"}>
                        {u.role}
                      </Badge>
                      <div className="text-xs text-muted-foreground">
                        {u.teams?.map((t) => t.team?.name).filter(Boolean).join(", ") || "No team"}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
