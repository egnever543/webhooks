import type { VercelResponse } from '@vercel/node';

export function json(res: VercelResponse, status: number, body: unknown): void {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(body));
}

/** Compara duas strings em tempo (aproximadamente) constante. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Valida o token de administração (header Authorization: Bearer <ADMIN_TOKEN>). */
export function isAdmin(authHeader: string | undefined): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false;
  if (!authHeader?.startsWith('Bearer ')) return false;
  return safeEqual(authHeader.slice(7), token);
}
