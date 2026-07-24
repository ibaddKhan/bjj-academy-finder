import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

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
if (
  typeof window === "undefined" &&
  process.env.NEXT_PHASE !== "phase-production-build"
) {
  initWorker();
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
