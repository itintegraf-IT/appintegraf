/**
 * Spustí scripts/planovani-db-upgrade.sql proti databázi z .env (DATABASE_URL).
 * Ignoruje chyby typu „sloupec/tab už existuje“ (opakované spuštění).
 */
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createConnection } from "mysql2/promise";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");

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
  return (
    s.includes("duplicate column") ||
    s.includes("duplicate key name") ||
    s.includes("already exists") ||
    (s.includes("table") && s.includes("already exists"))
  );
}

async function main() {
  const sqlPath = join(root, "scripts", "planovani-db-upgrade.sql");
  let sql = readFileSync(sqlPath, "utf8");
  sql = sql
    .split("\n")
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");

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

  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    const full = stmt.endsWith(";") ? stmt : `${stmt};`;
    try {
      await conn.query(full);
      console.log("OK:", full.slice(0, 70).replace(/\s+/g, " ") + (full.length > 70 ? "…" : ""));
    } catch (e) {
      if (ignorableError(e.message)) {
        console.warn("Přeskočeno (už aplikováno):", e.code ?? "", e.message.slice(0, 120));
      } else {
        console.error("Chyba SQL:", e.message);
        console.error(full.slice(0, 200));
        await conn.end();
        process.exit(1);
      }
    }
  }

  const seedSql = `
INSERT IGNORE INTO planovani_machine_work_hours (machine, dayOfWeek, startHour, endHour, isActive) VALUES
('XL_105', 1, 6, 22, 1), ('XL_105', 2, 6, 22, 1), ('XL_105', 3, 6, 22, 1), ('XL_105', 4, 6, 22, 1), ('XL_105', 5, 6, 22, 1), ('XL_105', 6, 0, 24, 0), ('XL_105', 0, 0, 24, 0),
('XL_106', 1, 6, 22, 1), ('XL_106', 2, 6, 22, 1), ('XL_106', 3, 6, 22, 1), ('XL_106', 4, 6, 22, 1), ('XL_106', 5, 6, 22, 1), ('XL_106', 6, 0, 24, 0), ('XL_106', 0, 0, 24, 0)
`;
  try {
    await conn.query(seedSql);
    console.log("OK: výchozí směny strojů (INSERT IGNORE).");
  } catch (e) {
    console.warn("Seed směn:", e.message);
  }

  await conn.end();
  console.log("Hotovo.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
