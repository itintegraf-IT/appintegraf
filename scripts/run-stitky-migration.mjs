/**
 * Vytvoří tabulky modulu Štítky (CREATE TABLE IF NOT EXISTS).
 * Použití: npm run db:stitky-migrate
 */
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createConnection } from "mysql2/promise";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");

const SQL_PATHS = [
  join(root, "prisma", "migrations", "20260619120000_stitky_module", "migration.sql"),
  join(root, "prisma", "migrations", "20260619130000_stitky_templates_standard_fallback", "migration.sql"),
];

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
  try {
    const u = new URL(url.replace(/^mysql:\/\//, "http://"));
    const database = u.pathname.replace(/^\//, "").split("?")[0];
    return {
      host: u.hostname || "localhost",
      port: u.port ? Number(u.port) : 3306,
      user: decodeURIComponent(u.username || "root"),
      password: decodeURIComponent(u.password || ""),
      database: database || "appintegraf",
    };
  } catch (e) {
    console.error("Neplatný DATABASE_URL:", e.message);
    process.exit(1);
  }
}

function ignorableError(msg) {
  const s = String(msg).toLowerCase();
  return s.includes("already exists") || s.includes("duplicate");
}

async function runSqlFile(conn, sqlPath) {
  if (!existsSync(sqlPath)) {
    console.error("Nenalezen SQL soubor:", sqlPath);
    process.exit(1);
  }

  let sql = readFileSync(sqlPath, "utf8");
  sql = sql
    .split("\n")
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");

  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    const preview = stmt.replace(/\s+/g, " ").slice(0, 70);
    try {
      await conn.query(stmt);
      console.log(`OK: ${preview}…`);
    } catch (e) {
      if (ignorableError(e.message)) {
        console.log(`Přeskočeno (už existuje): ${preview}…`);
      } else {
        console.error(`Chyba: ${e.message}`);
        throw e;
      }
    }
  }
}

async function main() {
  const cfg = parseMysqlUrl(loadDatabaseUrl());
  const conn = await createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    multipleStatements: true,
  });

  console.log(`Připojeno k ${cfg.host}:${cfg.port}/${cfg.database}`);

  try {
    for (const sqlPath of SQL_PATHS) {
      console.log(`\n→ ${sqlPath}`);
      await runSqlFile(conn, sqlPath);
    }
  } catch {
    await conn.end();
    process.exit(1);
  }

  await conn.end();
  console.log("\nMigrace modulu Štítky dokončena.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
