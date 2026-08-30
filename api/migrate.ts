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
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  if (!isAdmin(req.headers.authorization)) return json(res, 401, { error: 'unauthorized' });

  for (const stmt of STATEMENTS) {
    await sql(stmt);
  }
  return json(res, 200, { ok: true, migrated: STATEMENTS.length });
}
