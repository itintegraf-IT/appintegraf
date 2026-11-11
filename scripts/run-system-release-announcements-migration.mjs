/**
 * Tabulka system_release_announcements (idempotence systémových novinek).
 * Použití: npm run db:system-release-announcements
 */
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createConnection } from "mysql2/promise";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");
const SQL_PATH = join(
  root,
  "prisma",
  "migrations",
  "20261111_system_release_announcements.sql"
);

function loadDatabaseUrl() {
  if (!existsSync(envPath)) {
    console.error("Chybí soubor .env v kořeni projektu.");
    process.exit(1);
  }
  const raw = readFileSync(envPath, "utf8");
  const m = raw.match(/^\s*DATABASE_URL\s*=\s*["']?([^'"#\n]+)["']?/m);
  if (!m) {
    console.error("V .env není DATABASE_URL.");
    process.exit(1);
  }
  return m[1].trim();
}

function parseMysqlUrl(url) {
  const u = new URL(url.replace(/^mysql:\/\//, "http://"));
  return {
    host: u.hostname || "localhost",
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username || "root"),
    password: decodeURIComponent(u.password || ""),
    database: u.pathname.replace(/^\//, "").split("?")[0] || "appintegraf",
  };
}

function ignorableError(msg) {
  const s = String(msg).toLowerCase();
  return s.includes("already exists") || s.includes("duplicate");
}

async function main() {
  if (!existsSync(SQL_PATH)) {
    console.error("Nenalezen SQL:", SQL_PATH);
    process.exit(1);
  }

  let sql = readFileSync(SQL_PATH, "utf8");
  sql = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  const cfg = parseMysqlUrl(loadDatabaseUrl());
  const conn = await createConnection(cfg);
  try {
    for (const statement of sql.split(";").map((s) => s.trim()).filter(Boolean)) {
      try {
        await conn.query(statement);
        console.log("OK:", statement.slice(0, 80).replace(/\s+/g, " ") + "…");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (ignorableError(msg)) {
          console.log("Skip (už existuje):", msg);
          continue;
        }
        throw e;
      }
    }
    console.log("system_release_announcements: hotovo.");
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
