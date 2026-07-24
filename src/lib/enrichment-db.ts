import { Pool } from "pg";

// Separate pool for the event_enrichments database
const globalForEnrichmentDb = globalThis as unknown as {
  enrichmentPool: Pool | undefined;
};

function getPool(): Pool {
  if (!globalForEnrichmentDb.enrichmentPool) {
    const url = process.env.ENRICHMENT_DATABASE_URL;
    if (!url) throw new Error("ENRICHMENT_DATABASE_URL is not set");
    globalForEnrichmentDb.enrichmentPool = new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
    });
  }
  return globalForEnrichmentDb.enrichmentPool;
}

export async function enrichmentExists(gymName: string): Promise<boolean> {
  const pool = getPool();
  const res = await pool.query(
    "SELECT id FROM event_enrichments WHERE name_id = $1 LIMIT 1",
    [gymName]
  );
  return res.rowCount !== null && res.rowCount > 0;
}

export interface EnrichmentPayload {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  gym_academy_url?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  owner_person_in_charge?: string | null;
  source?: string | null;
  owner_instagram?: string | null;
  coaches?: string | null;
}

export async function upsertEnrichment(
  gymName: string,
  payload: EnrichmentPayload
): Promise<void> {
  const pool = getPool();

  // Check if exists
  const existing = await pool.query(
    "SELECT id FROM event_enrichments WHERE name_id = $1 LIMIT 1",
    [gymName]
  );

  if (existing.rowCount && existing.rowCount > 0) {
    await pool.query(
      `UPDATE event_enrichments SET
        name = $1, email = $2, phone = $3, address = $4, city = $5,
        state = $6, country = $7, gym_academy_url = $8, facebook = $9,
        instagram = $10, owner_person_in_charge = $11, source = $12,
        owner_instagram = $13, coaches = $14
      WHERE name_id = $15`,
      [
        payload.name ?? null,
        payload.email ?? null,
        payload.phone ?? null,
        payload.address ?? null,
        payload.city ?? null,
        payload.state ?? null,
        payload.country ?? null,
        payload.gym_academy_url ?? null,
        payload.facebook ?? null,
        payload.instagram ?? null,
        payload.owner_person_in_charge ?? null,
        payload.source ?? null,
        payload.owner_instagram ?? null,
        payload.coaches ?? null,
        gymName,
      ]
    );
  } else {
    await pool.query(
      `INSERT INTO event_enrichments
        (name_id, name, email, phone, address, city, state, country,
         gym_academy_url, facebook, instagram, owner_person_in_charge,
         source, owner_instagram, coaches)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        gymName,
        payload.name ?? null,
        payload.email ?? null,
        payload.phone ?? null,
        payload.address ?? null,
        payload.city ?? null,
        payload.state ?? null,
        payload.country ?? null,
        payload.gym_academy_url ?? null,
        payload.facebook ?? null,
        payload.instagram ?? null,
        payload.owner_person_in_charge ?? null,
        payload.source ?? null,
        payload.owner_instagram ?? null,
        payload.coaches ?? null,
      ]
    );
  }
}
