import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../lib/db.js';
import { json, isAdmin } from '../lib/http.js';

/**
 * Consulta eventos armazenados.
 *
 *   GET /api/events?client=acme&project=site&type=order.paid&limit=50&before=<id>
 *   Header: Authorization: Bearer <ADMIN_TOKEN>
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'method_not_allowed' });
  }
  if (!isAdmin(req.headers.authorization)) {
    return json(res, 401, { error: 'unauthorized' });
  }

  const client = req.query.client ? String(req.query.client) : null;
  const project = req.query.project ? String(req.query.project) : null;
  const type = req.query.type ? String(req.query.type) : null;
  const before = req.query.before ? Number(req.query.before) : null; // paginação por id
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

  const rows = await sql`
    SELECT id, client_id, project_id, type, payload, source_ip, received_at
    FROM events
    WHERE (${client}::text IS NULL OR client_id = ${client})
      AND (${project}::text IS NULL OR project_id = ${project})
      AND (${type}::text IS NULL OR type = ${type})
      AND (${before}::bigint IS NULL OR id < ${before})
    ORDER BY id DESC
    LIMIT ${limit}
  `;

  return json(res, 200, {
    count: rows.length,
    events: rows.map((r) => ({ ...r, id: String(r.id) })),
    next_before: rows.length ? String(rows[rows.length - 1].id) : null,
  });
}
