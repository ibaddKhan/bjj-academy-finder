import { redirect } from "next/navigation";
import { getServerAuthUser } from "@/lib/auth/middleware";
import { Navbar } from "@/components/Navbar";
import { db } from "@/lib/db";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Building2, Shield } from "lucide-react";

export default async function AdminPage() {
  const user = await getServerAuthUser();
  if (!user) redirect("/login");
  if (user.role !== "super_admin") redirect("/");

  const [userCount, teamCount] = await Promise.all([
    db.user.count(),
    db.team.count(),
  ]);

  return (
    <div className="min-h-screen">
      <Navbar user={user} />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Shield className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Manage users and teams</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{userCount}</p>
              <Button asChild className="mt-3" variant="outline" size="sm">
                <Link href="/admin/users">Manage Users</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Teams
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{teamCount}</p>
              <Button asChild className="mt-3" variant="outline" size="sm">
                <Link href="/admin/teams">Manage Teams</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
