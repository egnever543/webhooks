import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../lib/db.js';
import { json, isAdmin } from '../lib/http.js';

const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Gerencia clientes.
 *   GET  /api/clients                      -> lista
 *   POST /api/clients  { id, name }        -> cria
 * Header: Authorization: Bearer <ADMIN_TOKEN>
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAdmin(req.headers.authorization)) {
    return json(res, 401, { error: 'unauthorized' });
  }

  if (req.method === 'GET') {
    const rows = await sql`SELECT id, name, created_at FROM clients ORDER BY id`;
    return json(res, 200, { clients: rows });
  }

  if (req.method === 'POST') {
    const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) ?? {};
    const id = String(body.id ?? '').trim();
    const name = String(body.name ?? '').trim();
    if (!SLUG.test(id)) {
      return json(res, 400, { error: 'invalid_id', hint: 'use [a-z0-9-], ex.: acme' });
    }
    if (!name) return json(res, 400, { error: 'missing_name' });

    try {
      await sql`INSERT INTO clients (id, name) VALUES (${id}, ${name})`;
    } catch (e) {
      return json(res, 409, { error: 'already_exists' });
    }
    return json(res, 201, { ok: true, id, name });
  }

  return json(res, 405, { error: 'method_not_allowed' });
}
