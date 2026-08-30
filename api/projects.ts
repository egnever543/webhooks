import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes } from 'node:crypto';
import { sql } from '../lib/db.js';
import { json, isAdmin } from '../lib/http.js';

const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Gerencia projetos de um cliente.
 *   GET  /api/projects?client=acme                    -> lista (sem expor o segredo)
 *   POST /api/projects  { client, id, name }          -> cria e RETORNA o segredo (uma vez)
 * Header: Authorization: Bearer <ADMIN_TOKEN>
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAdmin(req.headers.authorization)) {
    return json(res, 401, { error: 'unauthorized' });
  }

  if (req.method === 'GET') {
    const client = req.query.client ? String(req.query.client) : null;
    const rows = await sql`
      SELECT client_id, id, name, active, created_at FROM projects
      WHERE (${client}::text IS NULL OR client_id = ${client})
      ORDER BY client_id, id
    `;
    return json(res, 200, { projects: rows });
  }

  if (req.method === 'POST') {
    const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) ?? {};
    const client = String(body.client ?? '').trim();
    const id = String(body.id ?? '').trim();
    const name = String(body.name ?? '').trim();
    if (!SLUG.test(client)) return json(res, 400, { error: 'invalid_client' });
    if (!SLUG.test(id)) return json(res, 400, { error: 'invalid_id' });
    if (!name) return json(res, 400, { error: 'missing_name' });

    const secret = randomBytes(24).toString('base64url');

    try {
      await sql`
        INSERT INTO projects (client_id, id, name, secret)
        VALUES (${client}, ${id}, ${name}, ${secret})
      `;
    } catch (e) {
      // Cliente inexistente (FK) ou projeto duplicado (PK).
      return json(res, 409, { error: 'conflict', hint: 'cliente não existe ou projeto já existe' });
    }

    const base = `${req.headers['x-forwarded-proto'] ?? 'https'}://${req.headers.host}`;
    return json(res, 201, {
      ok: true,
      client,
      id,
      name,
      secret, // guarde agora — não é possível recuperar depois
      ingest_url: `${base}/api/ingest/${client}/${id}`,
    });
  }

  return json(res, 405, { error: 'method_not_allowed' });
}
