import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { auth } from "@/lib/auth";
import { AuthProvider } from "@/components/AuthProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BJJ Academy Finder",
  description: "AI-powered tool to find BJJ competitors' current training gyms",
};

// Start BullMQ worker in the Next.js process
async function initWorker() {
  if (process.env.NODE_ENV !== "test") {
    try {
      const { startWorker } = await import("@/workers/processor");
      startWorker();
    } catch (err) {
      console.error("Failed to start worker:", err);
    }
  }
}

// Only init once (not during build)
if (typeof window === "undefined" && process.env.NEXT_PHASE !== "phase-production-build") {
  initWorker();
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <AuthProvider session={session}>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
