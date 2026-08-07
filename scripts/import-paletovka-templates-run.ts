/**
 * Hromadný import šablon paletovek ze složky.
 * Použití: npm run import:paletovka-templates
 */
import { readFileSync, existsSync, readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createConnection } from "mysql2/promise";
import { parsePaletovkaXlsBuffer } from "../lib/stitky/paletovky/xls-import";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");

function loadEnv() {
  if (!existsSync(envPath)) process.exit(1);
  const raw = readFileSync(envPath, "utf8");
  const get = (key: string) => {
    const m = raw.match(new RegExp(`^\\s*${key}\\s*=\\s*["']?([^"'#\\n]+)`, "m"));
    return m ? m[1].trim() : "";
  };
  return {
    databaseUrl: get("DATABASE_URL"),
    templatesDir:
      get("PALETOVKY_TEMPLATES_DIR") ||
      "\\\\SRV-IGFile\\Management\\Vyroba\\Mistri\\POPIČKY RUDY",
    userId: parseInt(get("IMPORT_USER_ID") || "1", 10),
    limit: parseInt(get("IMPORT_LIMIT") || "100", 10),
  };
}

function parseMysqlUrl(url: string) {
  const u = new URL(url.replace(/^mysql:\/\//, "http://"));
  return {
    host: u.hostname || "localhost",
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username || "root"),
    password: decodeURIComponent(u.password || ""),
    database: u.pathname.replace(/^\//, "").split("?")[0] || "appintegraf",
  };
}

async function main() {
  const { databaseUrl, templatesDir, userId, limit } = loadEnv();
  if (!databaseUrl) {
    console.error("Chybí DATABASE_URL");
    process.exit(1);
  }
  if (!existsSync(templatesDir)) {
    console.error("Složka nenalezena:", templatesDir);
    process.exit(1);
  }

  const files = readdirSync(templatesDir)
    .filter((f) => /\.(xls|xlsx)$/i.test(f) && !f.startsWith("~$"))
    .slice(0, limit);

  const cfg = parseMysqlUrl(databaseUrl);
  const conn = await createConnection(cfg);

  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const file of files) {
    const [existing] = await conn.query(
      "SELECT id FROM stitky_paletovka_templates WHERE source_filename = ? OR name = ? LIMIT 1",
      [file, file.replace(/\.(xls|xlsx)$/i, "")]
    );
    if (Array.isArray(existing) && existing.length > 0) {
      skip++;
      continue;
    }
    try {
      const buffer = readFileSync(join(templatesDir, file));
      const parsed = parsePaletovkaXlsBuffer(buffer, file);
      await conn.query(
        `INSERT INTO stitky_paletovka_templates
         (name, layout_variant, blocks_per_page, layout_json, defaults_json, source_filename, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          parsed.name,
          parsed.layoutVariant,
          parsed.blocksPerPage,
          JSON.stringify(parsed.layoutJson),
          JSON.stringify(parsed.defaults),
          file,
          userId,
        ]
      );
      ok++;
      console.log("OK:", file);
    } catch (e) {
      fail++;
      console.error("FAIL:", file, e instanceof Error ? e.message : e);
    }
  }

  await conn.end();
  console.log(`\nHotovo: importováno ${ok}, přeskočeno ${skip}, chyb ${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
