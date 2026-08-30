import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../lib/db.js';
import { json } from '../lib/http.js';

/** Verificação simples de saúde + conexão com o banco. */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const r = await sql`SELECT 1 AS ok`;
    return json(res, 200, { status: 'ok', db: r[0]?.ok === 1 });
  } catch (e) {
    return json(res, 500, { status: 'degraded', db: false });
  }
}
