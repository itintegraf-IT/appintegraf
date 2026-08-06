/**
 * Výchozí šablony paletovek z fixture XLS.
 * Použití: npm run db:paletovka-templates-seed
 */
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createConnection } from "mysql2/promise";
import {
  DEFAULT_PALETOVKA_TEMPLATES,
  getDefaultTemplateFixturePath,
} from "../lib/stitky/paletovky/default-templates";
import { parsePaletovkaXlsFile } from "../lib/stitky/paletovky/xls-import";

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
    userId: parseInt(get("IMPORT_USER_ID") || "1", 10),
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
  const { databaseUrl, userId } = loadEnv();
  if (!databaseUrl) {
    console.error("Chybí DATABASE_URL");
    process.exit(1);
  }

  const cfg = parseMysqlUrl(databaseUrl);
  const conn = await createConnection(cfg);

  const [userRows] = await conn.query("SELECT id FROM users ORDER BY id ASC LIMIT 1");
  const firstUserId =
    Array.isArray(userRows) && userRows.length > 0
      ? Number((userRows[0] as { id: number }).id)
      : userId;
  if (!firstUserId || Number.isNaN(firstUserId)) {
    console.error("V DB není žádný uživatel — nejdřív vytvořte účet (npm run db:ensure-admin).");
    await conn.end();
    process.exit(1);
  }

  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const tpl of DEFAULT_PALETOVKA_TEMPLATES) {
    const path = getDefaultTemplateFixturePath(tpl.fixtureFile);
    if (!existsSync(path)) {
      fail++;
      console.error("FAIL: fixture nenalezen:", path);
      continue;
    }

    const [existing] = await conn.query(
      "SELECT id FROM stitky_paletovka_templates WHERE source_filename = ? OR name = ? LIMIT 1",
      [tpl.sourceFilename, tpl.displayName]
    );
    if (Array.isArray(existing) && existing.length > 0) {
      skip++;
      console.log("SKIP:", tpl.displayName);
      continue;
    }

    try {
      const parsed = parsePaletovkaXlsFile(path);
      await conn.query(
        `INSERT INTO stitky_paletovka_templates
         (name, layout_variant, blocks_per_page, layout_json, defaults_json, source_filename, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          tpl.displayName,
          parsed.layoutVariant,
          parsed.blocksPerPage,
          JSON.stringify(parsed.layoutJson),
          JSON.stringify(parsed.defaults),
          tpl.sourceFilename,
          firstUserId,
        ]
      );
      ok++;
      console.log("OK:", tpl.displayName);
    } catch (e) {
      fail++;
      console.error("FAIL:", tpl.displayName, e instanceof Error ? e.message : e);
    }
  }

  await conn.end();
  console.log(`\nHotovo: vytvořeno ${ok}, přeskočeno ${skip}, chyb ${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
