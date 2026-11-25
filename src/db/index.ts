import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/** Remove parâmetros extras da URL (ex.: "?sslmode=require&supa=..." da integração Supabase/Vercel),
 *  que o driver repassaria ao servidor como configuração. O SSL é definido explicitamente abaixo. */
export function cleanUrl(url: string) {
  return url.split("?")[0];
}

function connectionString() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Defina POSTGRES_URL (ou DATABASE_URL) com a conexão do Postgres.");
  }
  return cleanUrl(url);
}

declare global {
  var __pgClient: ReturnType<typeof postgres> | undefined;
}

function client() {
  if (!globalThis.__pgClient) {
    const url = connectionString();
    const isLocal = /localhost|127\.0\.0\.1/.test(url);
    globalThis.__pgClient = postgres(url, {
      // O pooler do Supabase (modo transação) não suporta prepared statements.
      prepare: false,
      max: isLocal ? 10 : 3,
      idle_timeout: 20,
      connect_timeout: 15,
      ssl: isLocal ? false : "require",
    });
  }
  return globalThis.__pgClient;
}

export const db = drizzle(client(), { schema, casing: "snake_case" });
export type DB = typeof db;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export { schema };
