/**
 * Číselník velikostí archů + migrace sheet_size_text → sheet_size_id.
 * Použití: npm run db:technologie-sheet-sizes-migrate
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

async function tableExists(conn, name) {
  const [rows] = await conn.query(
    `SELECT 1 AS ok FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1`,
    [name]
  );
  return rows.length > 0;
}

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 AS ok FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

async function fkExists(conn, name) {
  const [rows] = await conn.query(
    `SELECT 1 AS ok FROM information_schema.table_constraints
     WHERE table_schema = DATABASE() AND constraint_name = ? AND constraint_type = 'FOREIGN KEY' LIMIT 1`,
    [name]
  );
  return rows.length > 0;
}

async function findOrCreateSize(conn, name, sortOrder) {
  const [existing] = await conn.query(
    `SELECT id FROM technologie_sheet_sizes WHERE name = ? LIMIT 1`,
    [name]
  );
  if (existing.length > 0) return existing[0].id;
  const [result] = await conn.query(
    `INSERT INTO technologie_sheet_sizes (name, sort_order, is_active) VALUES (?, ?, TRUE)`,
    [name.slice(0, 64), sortOrder]
  );
  return result.insertId;
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
    if (!(await tableExists(conn, "technologie"))) {
      console.error("Tabulka technologie neexistuje – nejdřív npm run db:technologie-migrate");
      process.exit(1);
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`technologie_sheet_sizes\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`name\` VARCHAR(64) NOT NULL,
        \`is_active\` BOOLEAN NOT NULL DEFAULT TRUE,
        \`sort_order\` INT NOT NULL DEFAULT 0,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_technologie_sheet_sizes_active\` (\`is_active\`),
        KEY \`idx_technologie_sheet_sizes_sort\` (\`sort_order\`),
        KEY \`idx_technologie_sheet_sizes_name\` (\`name\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("OK: technologie_sheet_sizes");

    const defaults = [
      ["1020x720", 0],
      ["1000x700", 1],
      ["900x640", 2],
      ["900x630", 3],
    ];
    for (const [name, sort] of defaults) {
      const id = await findOrCreateSize(conn, name, sort);
      console.log(`Seed: ${name} → id ${id}`);
    }

    if (!(await columnExists(conn, "technologie", "sheet_size_id"))) {
      await conn.query(
        `ALTER TABLE technologie ADD COLUMN sheet_size_id INT NULL AFTER format_text`
      );
      console.log("OK: add sheet_size_id");
    }

    if (await columnExists(conn, "technologie", "sheet_size_text")) {
      const [rows] = await conn.query(
        `SELECT id, sheet_size_text FROM technologie
         WHERE sheet_size_text IS NOT NULL AND TRIM(sheet_size_text) <> ''`
      );
      for (const row of rows) {
        const name = String(row.sheet_size_text).trim().slice(0, 64);
        const sizeId = await findOrCreateSize(conn, name, 100);
        await conn.query(`UPDATE technologie SET sheet_size_id = ? WHERE id = ?`, [
          sizeId,
          row.id,
        ]);
        console.log(`Map technologie ${row.id}: "${name}" → size ${sizeId}`);
      }

      await conn.query(`ALTER TABLE technologie DROP COLUMN sheet_size_text`);
      console.log("OK: drop sheet_size_text");
    }

    if (!(await fkExists(conn, "technologie_sheet_size_fk"))) {
      await conn.query(`
        ALTER TABLE technologie
        ADD CONSTRAINT technologie_sheet_size_fk
        FOREIGN KEY (sheet_size_id) REFERENCES technologie_sheet_sizes (id)
        ON DELETE SET NULL ON UPDATE NO ACTION
      `);
      console.log("OK: technologie_sheet_size_fk");
    }

    if (!(await columnExists(conn, "technologie", "idx_check"))) {
      // ensure index
    }
    try {
      await conn.query(
        `CREATE INDEX idx_technologie_sheet_size ON technologie (sheet_size_id)`
      );
      console.log("OK: idx_technologie_sheet_size");
    } catch (e) {
      if (!String(e.message).toLowerCase().includes("duplicate")) {
        throw e;
      }
      console.log("Přeskočeno: idx_technologie_sheet_size už existuje");
    }

    console.log("\nMigrace velikostí archů dokončena.");
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
