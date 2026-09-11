import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../lib/db.js';
import { json, isAdmin } from '../lib/http.js';

/**
 * Rollup de tráfego por site, para o painel /sites.
 *   GET /api/stats
 *   Header: Authorization: Bearer <ADMIN_TOKEN>
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });
  if (!isAdmin(req.headers.authorization)) return json(res, 401, { error: 'unauthorized' });

  let rows;
  try {
    rows = await sql`
      SELECT p.client_id, p.id AS project_id, p.name, p.active,
             s.last_seen, s.last_paid_at, s.last_free_at,
             COALESCE(s.total_paid, 0) AS total_paid,
             COALESCE(s.total_free, 0) AS total_free,
             COALESCE(d.paid, 0) AS today_paid,
             COALESCE(d.free, 0) AS today_free
      FROM projects p
      LEFT JOIN project_stats s
        ON s.client_id = p.client_id AND s.project_id = p.id
      LEFT JOIN project_daily d
        ON d.client_id = p.client_id AND d.project_id = p.id AND d.day = CURRENT_DATE
      ORDER BY s.last_seen DESC NULLS LAST, p.client_id, p.id
    `;
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    const needsMigrate = /relation .*(project_stats|projects).* does not exist/i.test(detail);
    return json(res, 500, {
      error: 'query_failed',
      detail,
      hint: needsMigrate
        ? 'Tabelas ausentes. Rode POST /api/migrate uma vez.'
        : 'Verifique DATABASE_URL nas variáveis do Vercel.',
    });
  }

  return json(res, 200, {
    sites: rows.map((r) => ({
      ...r,
      total_paid: Number(r.total_paid),
      total_free: Number(r.total_free),
      today_paid: Number(r.today_paid),
      today_free: Number(r.today_free),
    })),
  });
}
