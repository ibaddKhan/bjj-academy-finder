/**
 * This route exists purely to trigger the BullMQ worker startup
 * when the app first receives a request. In production on Railway,
 * the worker starts automatically via layout.tsx server init.
 */
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true });
}
