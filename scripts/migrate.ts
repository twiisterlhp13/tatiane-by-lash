/**
 * Aplica as migrations pendentes. Roda automaticamente antes do build na Vercel.
 * Usa a conexão direta (sem pooler), exigida para DDL.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const url =
    process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    console.log("[migrate] Nenhuma conexão configurada; pulando migrations.");
    return;
  }
  const isLocal = /localhost|127\.0\.0\.1/.test(url);
  const sql = postgres(url.split("?")[0], { max: 1, ssl: isLocal ? false : "require", onnotice: () => {} });
  try {
    await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
    console.log("[migrate] Migrations aplicadas.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("[migrate] Falhou:", err);
  process.exit(1);
});
