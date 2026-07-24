import { redirect } from "next/navigation";
import { getServerAuthUser } from "@/lib/auth/middleware";
import { Navbar } from "@/components/Navbar";
import { SettingsForm } from "@/components/SettingsForm";

export default async function SettingsPage() {
  const user = await getServerAuthUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <Navbar user={user} />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure API keys and credentials for your team
          </p>
        </div>
        <SettingsForm />
      </main>
    </div>
  );
}
