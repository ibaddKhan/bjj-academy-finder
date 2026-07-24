import { NextResponse } from "next/server";
import { Pool } from "pg";

export async function GET() {
  const url = process.env.ENRICHMENT_DATABASE_URL;
  if (!url) {
    return NextResponse.json({ ok: false, error: "ENRICHMENT_DATABASE_URL is not set" }, { status: 500 });
  }

  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

  try {
    const res = await pool.query("SELECT COUNT(*) AS total FROM event_enrichments");
    return NextResponse.json({ ok: true, total_rows: parseInt(res.rows[0].total, 10) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  } finally {
    await pool.end();
  }
}
