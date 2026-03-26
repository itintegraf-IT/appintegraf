/**
 * Připojení zdroj → cíl pro migraci Plánování výroby.
 *
 * Priorita:
 * 1) SOURCE_DATABASE_URL nebo IDVYROBA_DATABASE_URL nebo IGVYROBA_DATABASE_URL (zdroj)
 * 2) DATABASE_URL z .env (cíl = appintegraf)
 * 3) Výchozí hodnoty níže (localhost, igvyroba → appintegraf)
 */
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");
const envPath = join(root, ".env");

function parseEnvFile() {
  const out = {};
  if (!existsSync(envPath)) return out;
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function parseMysqlUrl(url) {
  if (!url || typeof url !== "string") {
    throw new Error("Chybí nebo je neplatná connection URL");
  }
  const u = new URL(url.replace(/^mysql:\/\//, "http://"));
  const database = u.pathname.replace(/^\//, "").split("?")[0];
  return {
    host: u.hostname || "localhost",
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username || "root"),
    password: decodeURIComponent(u.password || ""),
    database: database || "",
  };
}

const fileEnv = parseEnvFile();
const pick = (key) => process.env[key] || fileEnv[key];

const defaultsSource = {
  host: "localhost",
  port: 3306,
  user: "root",
  password: "mysql",
  database: "igvyroba",
};

const defaultsTarget = {
  host: "localhost",
  port: 3306,
  user: "root",
  password: "mysql",
  database: "appintegraf",
};

const sourceUrl =
  pick("SOURCE_DATABASE_URL") || pick("IDVYROBA_DATABASE_URL") || pick("IGVYROBA_DATABASE_URL");

let source;
try {
  source = sourceUrl ? parseMysqlUrl(sourceUrl) : defaultsSource;
} catch {
  source = defaultsSource;
}

let target;
try {
  const dbUrl = pick("DATABASE_URL");
  target = dbUrl ? parseMysqlUrl(dbUrl) : defaultsTarget;
} catch {
  target = defaultsTarget;
}

export default { source, target };
