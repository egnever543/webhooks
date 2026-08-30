import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../../../lib/db.js';
import { json, safeEqual } from '../../../lib/http.js';

/**
 * Recebe um evento de webhook de um sistema externo.
 *
 *   POST /api/ingest/{client}/{project}
 *   Header:  X-Webhook-Secret: <segredo do projeto>
 *   Header:  X-Event-Type: <opcional, categoria do evento>
 *   Body:    JSON qualquer
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'method_not_allowed', hint: 'use POST' });
  }

  const client = String(req.query.client ?? '');
  const project = String(req.query.project ?? '');
  if (!client || !project) {
    return json(res, 400, { error: 'missing_ids' });
  }

  const rows = await sql`
    SELECT secret, active FROM projects
    WHERE client_id = ${client} AND id = ${project}
    LIMIT 1
  `;
  const proj = rows[0] as { secret: string; active: boolean } | undefined;

  // Mesma resposta para projeto inexistente e segredo errado (não vaza quais IDs existem).
  const provided = req.headers['x-webhook-secret'];
  const secretOk =
    proj !== undefined &&
    typeof provided === 'string' &&
    safeEqual(provided, proj.secret);

  if (!secretOk) {
    return json(res, 401, { error: 'unauthorized' });
  }
  if (!proj.active) {
    return json(res, 403, { error: 'project_inactive' });
  }

  // Corpo: a Vercel já faz parse de JSON; aceitamos também texto puro.
  let payload: unknown = req.body;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      payload = { raw: payload };
    }
  }
  if (payload === undefined || payload === null) payload = {};

  const headerType = req.headers['x-event-type'];
  const bodyType =
    payload && typeof payload === 'object' && 'type' in payload
      ? String((payload as Record<string, unknown>).type)
      : undefined;
  const type = (typeof headerType === 'string' ? headerType : bodyType) ?? null;

  // Guardamos apenas headers não sensíveis.
  const safeHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (k === 'x-webhook-secret' || k === 'authorization' || k === 'cookie') continue;
    if (typeof v === 'string') safeHeaders[k] = v;
  }

  const ip =
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
    null;

  const inserted = await sql`
    INSERT INTO events (client_id, project_id, type, payload, headers, source_ip)
    VALUES (${client}, ${project}, ${type}, ${JSON.stringify(payload)}::jsonb,
            ${JSON.stringify(safeHeaders)}::jsonb, ${ip})
    RETURNING id, received_at
  `;

  return json(res, 202, {
    ok: true,
    event_id: String(inserted[0].id),
    received_at: inserted[0].received_at,
  });
}
