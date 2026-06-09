#!/usr/bin/env node
/**
 * Aplikuje SQL migraci modulu CRM (prisma/migrations/20260608_crm_module.sql).
 * Spuštění: npm run db:crm-migrate
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import mariadb from "mariadb";
import dotenv from "dotenv";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, "..", "prisma", "migrations", "20260608_crm_module.sql");

function parseDatabaseUrl(url) {
  const u = new URL(url.replace(/^mysql:\/\//, "http://"));
  const database = u.pathname?.replace(/^\//, "").split(/[?#]/)[0] || undefined;
  return {
    host: u.hostname || "localhost",
    port: u.port ? parseInt(u.port, 10) : 3306,
    user: u.username || undefined,
    password: u.password || undefined,
    database,
    multipleStatements: true,
    allowPublicKeyRetrieval: true,
  };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL není nastaveno");

  const sql = readFileSync(sqlPath, "utf8");
  const conn = await mariadb.createConnection(parseDatabaseUrl(url));
  try {
    await conn.query(sql);
    console.log("[crm-migrate] OK — tabulky CRM vytvořeny");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("[crm-migrate] fail", err);
  process.exit(1);
});
