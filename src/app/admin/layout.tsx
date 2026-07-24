import { redirect } from "next/navigation";
import { getServerAuthUser } from "@/lib/auth/middleware";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getServerAuthUser();
  if (!user || user.role !== "super_admin") {
    redirect("/");
  }
  return <>{children}</>;
}
