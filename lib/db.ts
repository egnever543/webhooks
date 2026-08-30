import { neon } from '@neondatabase/serverless';

/**
 * Cliente SQL do Neon (serverless, via HTTP — ideal para funções da Vercel).
 * A connection string vem da env DATABASE_URL (defina no painel da Vercel /
 * localmente em .env). Use a "pooled connection string" do Neon.
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // Lançado no primeiro uso, não no import, para não quebrar o build.
  console.warn('[db] DATABASE_URL não definida — defina antes de usar o banco.');
}

export const sql = neon(connectionString ?? '');
