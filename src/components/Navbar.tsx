"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dumbbell,
  Settings,
  LogOut,
  Plus,
  LayoutDashboard,
  Shield,
  Building2,
} from "lucide-react";
import { AuthUser } from "@/lib/auth/jwt";
import { TeamSelector } from "@/components/TeamSelector";

interface NavbarProps {
  user?: AuthUser | null;
}

// Read user_info from cookie (non-httpOnly, set at login)
function getClientUser(): { name: string; username: string; role: string; teamId?: string } | null {
  if (typeof document === "undefined") return null;
  try {
    const match = document.cookie.match(/(?:^|;\s*)user_info=([^;]+)/);
    if (!match) return null;
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

export function Navbar({ user: serverUser }: NavbarProps) {
  const router = useRouter();

  // Use server-provided user if available (server components), else read from cookie
  const user =
    serverUser ??
    (typeof window !== "undefined" ? getClientUser() : null);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <Dumbbell className="h-6 w-6 text-primary" />
            <span>BJJ Academy Finder</span>
          </Link>

          {user && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/">
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  Dashboard
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/jobs/new">
                  <Plus className="h-4 w-4 mr-2" />
                  New Job
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/enrichment/new">
                  <Building2 className="h-4 w-4 mr-2" />
                  Enrich
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Link>
              </Button>
              {user.role === "super_admin" && (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/admin">
                    <Shield className="h-4 w-4 mr-2" />
                    Admin
                  </Link>
                </Button>
              )}

              <TeamSelector />

              <div className="flex items-center gap-2 ml-2 pl-2 border-l border-border">
                <span className="text-sm text-muted-foreground hidden sm:block">
                  {user.name}
                </span>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
