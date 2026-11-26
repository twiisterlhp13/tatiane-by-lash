import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import * as schema from "./schema";

/** Remove parâmetros extras da URL (ex.: "?sslmode=require&supa=..." da integração Supabase/Vercel).
 *  O SSL é definido explicitamente abaixo. */
export function cleanUrl(url: string) {
  return url.split("?")[0];
}

function connectionString() {
  // Pooler do Supabase em modo transação (porta 6543): aguenta muitas instâncias do servidor ao mesmo tempo.
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Defina POSTGRES_URL (ou DATABASE_URL) com a conexão do Postgres.");
  }
  return cleanUrl(url);
}

declare global {
  var __pgPool: Pool | undefined;
}

function pool() {
  if (!globalThis.__pgPool) {
    const url = connectionString();
    const isLocal = /localhost|127\.0\.0\.1/.test(url);
    const p = new Pool({
      connectionString: url,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: isLocal ? 10 : 5,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 10000,
      // nenhuma consulta pode travar a requisição: falha rápido com erro claro
      query_timeout: 20000,
    });
    p.on("error", (err) => console.error("[db] erro em conexão ociosa", err.message));
    // devolve as conexões ociosas antes de a instância do servidor ser suspensa
    if (!isLocal) attachDatabasePool(p);
    globalThis.__pgPool = p;
  }
  return globalThis.__pgPool;
}

export const db = drizzle(pool(), { schema, casing: "snake_case" });
export type DB = typeof db;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export { schema };
