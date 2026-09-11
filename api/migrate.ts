import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../lib/db.js';
import { json, isAdmin } from '../lib/http.js';

/**
 * Cria/atualiza o esquema do banco. Idempotente.
 *   POST /api/migrate
 *   Header: Authorization: Bearer <ADMIN_TOKEN>
 */
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS clients (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS projects (
     client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
     id TEXT NOT NULL,
     name TEXT NOT NULL,
     secret TEXT NOT NULL,
     active BOOLEAN NOT NULL DEFAULT true,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     PRIMARY KEY (client_id, id)
   )`,
  `CREATE TABLE IF NOT EXISTS events (
     id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
     client_id TEXT NOT NULL,
     project_id TEXT NOT NULL,
     type TEXT,
     payload JSONB NOT NULL,
     headers JSONB,
     source_ip TEXT,
     received_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_events_client_project
     ON events (client_id, project_id, received_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_events_type ON events (type)`,
  // Monitor de tráfego (track.js): contadores por site, sem guardar cada visita.
  `CREATE TABLE IF NOT EXISTS project_stats (
     client_id TEXT NOT NULL,
     project_id TEXT NOT NULL,
     last_seen TIMESTAMPTZ,
     last_paid_at TIMESTAMPTZ,
     last_free_at TIMESTAMPTZ,
     total_paid BIGINT NOT NULL DEFAULT 0,
     total_free BIGINT NOT NULL DEFAULT 0,
     PRIMARY KEY (client_id, project_id)
   )`,
  `CREATE TABLE IF NOT EXISTS project_daily (
     client_id TEXT NOT NULL,
     project_id TEXT NOT NULL,
     day DATE NOT NULL,
     paid BIGINT NOT NULL DEFAULT 0,
     free BIGINT NOT NULL DEFAULT 0,
     PRIMARY KEY (client_id, project_id, day)
   )`,
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  if (!isAdmin(req.headers.authorization)) return json(res, 401, { error: 'unauthorized' });

  try {
    for (const stmt of STATEMENTS) {
      await sql(stmt);
    }
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return json(res, 500, {
      error: 'migrate_failed',
      detail,
      hint: 'Verifique DATABASE_URL (pooled connection string do Neon) nas variáveis do Vercel.',
    });
  }
  return json(res, 200, { ok: true, migrated: STATEMENTS.length });
}
