import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../../../lib/db.js';
import { classifyTraffic } from '../../../lib/track.js';

/**
 * Endpoint PÚBLICO de rastreamento de visitas (usado pelo track.js no navegador).
 * Não exige segredo — o snippet roda no cliente. Em vez de armazenar cada visita,
 * apenas atualiza contadores por site (última visita + total pago/grátis + hoje).
 *
 *   POST /api/track/{client}/{project}
 *   Body (text/plain JSON): { "u": "<url de entrada>", "r": "<referrer>" }
 *
 * Responde sempre 204 rápido, para não impactar a página de origem.
 */
function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).end();

  const client = String(req.query.client ?? '');
  const project = String(req.query.project ?? '');
  if (!client || !project) return res.status(204).end();

  // Só contabiliza sites cadastrados e ativos (evita lixo em URLs adivinhadas).
  const proj = await sql`
    SELECT 1 FROM projects
    WHERE client_id = ${client} AND id = ${project} AND active = true
    LIMIT 1
  `;
  if (proj.length === 0) return res.status(204).end();

  // Corpo pode vir como string (sendBeacon usa text/plain) ou já parseado.
  let body: { u?: string; r?: string } = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
  } catch {
    body = {};
  }
  const entryUrl = typeof body.u === 'string' ? body.u : '';
  const isPaid = classifyTraffic(entryUrl) === 'paid';

  const paidInc = isPaid ? 1 : 0;
  const freeInc = isPaid ? 0 : 1;

  await sql`
    INSERT INTO project_stats
      (client_id, project_id, last_seen, last_paid_at, last_free_at, total_paid, total_free)
    VALUES
      (${client}, ${project}, now(),
       CASE WHEN ${isPaid} THEN now() ELSE NULL END,
       CASE WHEN ${isPaid} THEN NULL ELSE now() END,
       ${paidInc}, ${freeInc})
    ON CONFLICT (client_id, project_id) DO UPDATE SET
      last_seen    = now(),
      last_paid_at = COALESCE(EXCLUDED.last_paid_at, project_stats.last_paid_at),
      last_free_at = COALESCE(EXCLUDED.last_free_at, project_stats.last_free_at),
      total_paid   = project_stats.total_paid + ${paidInc},
      total_free   = project_stats.total_free + ${freeInc}
  `;

  await sql`
    INSERT INTO project_daily (client_id, project_id, day, paid, free)
    VALUES (${client}, ${project}, CURRENT_DATE, ${paidInc}, ${freeInc})
    ON CONFLICT (client_id, project_id, day) DO UPDATE SET
      paid = project_daily.paid + ${paidInc},
      free = project_daily.free + ${freeInc}
  `;

  return res.status(204).end();
}
