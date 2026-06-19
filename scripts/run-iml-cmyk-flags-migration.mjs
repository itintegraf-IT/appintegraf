/**
 * IML CMYK přepínače na produktu (manual/20260617_iml_product_cmyk_flags.sql).
 * Použití: npm run db:iml-cmyk-flags
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
  "manual",
  "20260617_iml_product_cmyk_flags.sql"
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
  return (
    s.includes("duplicate column") ||
    s.includes("already exists") ||
    s.includes("duplicate key")
  );
}

async function main() {
  if (!existsSync(SQL_PATH)) {
    console.error("Nenalezen SQL:", SQL_PATH);
    process.exit(1);
  }

  let sql = readFileSync(SQL_PATH, "utf8");
  sql = sql
    .split("\n")
    .filter((line) => !/^\s*--/.test(line))
    .join("\n")
    .trim();

  const cfg = parseMysqlUrl(loadDatabaseUrl());
  const conn = await createConnection({ ...cfg, multipleStatements: true });
  console.log(`Připojeno k ${cfg.host}:${cfg.port}/${cfg.database}`);

  try {
    await conn.query(sql);
    console.log("OK: IML CMYK sloupce");
  } catch (e) {
    if (ignorableError(e.message)) {
      console.log("Přeskočeno (už existuje): IML CMYK sloupce");
    } else {
      console.error(`Chyba: ${e.message}`);
      await conn.end();
      process.exit(1);
    }
  }

  await conn.end();
  console.log("Migrace IML CMYK dokončena.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
