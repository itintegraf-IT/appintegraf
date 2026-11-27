/**
 * Migrace IT požadavků externích dodavatelů.
 * Použití: npm run db:it-vendor-requests-migrate
 */
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createConnection } from "mysql2/promise";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");

const SQL_FILES = [
  join(root, "prisma", "migrations", "20261127140000_it_vendor_requests", "migration.sql"),
  join(root, "prisma", "migrations", "20261127150000_it_vendor_contacts", "migration.sql"),
  join(root, "prisma", "migrations", "20261127160000_it_vendor_fw_assigned_ip", "migration.sql"),
  join(root, "prisma", "migrations", "20261127170000_it_network_registry", "migration.sql"),
  join(root, "prisma", "migrations", "20261127180000_it_network_ip_manual", "migration.sql"),
  join(root, "prisma", "migrations", "20261127190000_it_vendor_assigned_it_user", "migration.sql"),
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
    console.error(`Nenalezen SQL soubor: ${sqlPath}`);
    process.exit(1);
  }

  let sql = readFileSync(sqlPath, "utf8");
  sql = sql
    .split("\n")
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");

  console.log(`SQL: ${sqlPath}`);

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

  for (const sqlPath of SQL_FILES) {
    await runSqlFile(conn, sqlPath);
  }

  await conn.end();
  console.log("\nMigrace IT vendor requests dokončena.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
