/**
 * Společný číselník strojů (shared_machines) pro Výkresy + Technologie.
 * Migrace dat z vykresy_machines a technologie_print_machines.
 * Použití: npm run db:shared-machines-migrate
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

function guessGroup(name) {
  const n = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  if (n.includes("xl105") || n.includes("xl106") || n.startsWith("xl")) {
    return "press";
  }
  return "postpress";
}

async function tableExists(conn, name) {
  const [rows] = await conn.query(
    `SELECT 1 AS ok FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1`,
    [name]
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

async function ensureSharedTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`shared_machines\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`name\` VARCHAR(150) NOT NULL,
      \`machine_group\` VARCHAR(20) NOT NULL DEFAULT 'postpress',
      \`is_active\` BOOLEAN NOT NULL DEFAULT TRUE,
      \`sort_order\` INT NOT NULL DEFAULT 0,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_shared_machines_active\` (\`is_active\`),
      KEY \`idx_shared_machines_sort\` (\`sort_order\`),
      KEY \`idx_shared_machines_name\` (\`name\`),
      KEY \`idx_shared_machines_group\` (\`machine_group\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log("OK: shared_machines");
}

async function findOrCreateMachine(conn, { name, machine_group, is_active, sort_order }) {
  const [existing] = await conn.query(
    `SELECT id FROM shared_machines WHERE name = ? LIMIT 1`,
    [name]
  );
  if (existing.length > 0) {
    return existing[0].id;
  }
  const [result] = await conn.query(
    `INSERT INTO shared_machines (name, machine_group, is_active, sort_order)
     VALUES (?, ?, ?, ?)`,
    [name.slice(0, 150), machine_group, is_active !== false, sort_order ?? 0]
  );
  return result.insertId;
}

async function migrateVykresyMachines(conn) {
  if (!(await tableExists(conn, "vykresy_machines"))) {
    console.log("Přeskočeno: vykresy_machines neexistuje");
    return new Map();
  }
  if (!(await tableExists(conn, "vykresy"))) {
    console.log("Přeskočeno: vykresy neexistuje");
    return new Map();
  }

  const [rows] = await conn.query(
    `SELECT id, name, is_active, sort_order FROM vykresy_machines ORDER BY id`
  );
  const map = new Map();
  for (const row of rows) {
    const newId = await findOrCreateMachine(conn, {
      name: row.name,
      machine_group: guessGroup(row.name),
      is_active: row.is_active,
      sort_order: row.sort_order,
    });
    map.set(row.id, newId);
    console.log(`Map vykresy_machines ${row.id} → ${newId} (${row.name})`);
  }

  // Drop FK, update IDs, re-point FK
  if (await fkExists(conn, "vykresy_machine_fk")) {
    await conn.query(`ALTER TABLE vykresy DROP FOREIGN KEY vykresy_machine_fk`);
    console.log("OK: drop vykresy_machine_fk");
  }

  for (const [oldId, newId] of map) {
    if (oldId !== newId) {
      await conn.query(`UPDATE vykresy SET machine_id = ? WHERE machine_id = ?`, [
        newId,
        oldId,
      ]);
    }
  }

  // Null out orphan machine_ids that no longer exist
  await conn.query(`
    UPDATE vykresy v
    LEFT JOIN shared_machines sm ON sm.id = v.machine_id
    SET v.machine_id = NULL
    WHERE v.machine_id IS NOT NULL AND sm.id IS NULL
  `);

  if (!(await fkExists(conn, "vykresy_machine_fk"))) {
    await conn.query(`
      ALTER TABLE vykresy
      ADD CONSTRAINT vykresy_machine_fk
      FOREIGN KEY (machine_id) REFERENCES shared_machines (id)
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    console.log("OK: vykresy_machine_fk → shared_machines");
  }

  await conn.query(`DROP TABLE IF EXISTS vykresy_machines`);
  console.log("OK: drop vykresy_machines");
  return map;
}

async function migrateTechnologiePrintMachines(conn) {
  if (!(await tableExists(conn, "technologie"))) {
    console.log("Přeskočeno: technologie neexistuje (nejdřív db:technologie-migrate)");
    return;
  }

  if (await tableExists(conn, "technologie_print_machines")) {
    const [rows] = await conn.query(
      `SELECT id, name, is_active, sort_order FROM technologie_print_machines ORDER BY id`
    );
    const map = new Map();
    for (const row of rows) {
      const newId = await findOrCreateMachine(conn, {
        name: row.name,
        machine_group: "press",
        is_active: row.is_active,
        sort_order: row.sort_order,
      });
      map.set(row.id, newId);
      console.log(`Map technologie_print_machines ${row.id} → ${newId} (${row.name})`);
    }

    if (await fkExists(conn, "technologie_print_machine_fk")) {
      await conn.query(
        `ALTER TABLE technologie DROP FOREIGN KEY technologie_print_machine_fk`
      );
      console.log("OK: drop technologie_print_machine_fk");
    }

    for (const [oldId, newId] of map) {
      if (oldId !== newId) {
        await conn.query(
          `UPDATE technologie SET print_machine_id = ? WHERE print_machine_id = ?`,
          [newId, oldId]
        );
      }
    }

    await conn.query(`
      UPDATE technologie t
      LEFT JOIN shared_machines sm ON sm.id = t.print_machine_id
      SET t.print_machine_id = NULL
      WHERE t.print_machine_id IS NOT NULL AND sm.id IS NULL
    `);

    await conn.query(`DROP TABLE IF EXISTS technologie_print_machines`);
    console.log("OK: drop technologie_print_machines");
  } else {
    console.log("Přeskočeno: technologie_print_machines neexistuje");
  }

  if (!(await fkExists(conn, "technologie_print_machine_fk"))) {
    await conn.query(`
      ALTER TABLE technologie
      ADD CONSTRAINT technologie_print_machine_fk
      FOREIGN KEY (print_machine_id) REFERENCES shared_machines (id)
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    console.log("OK: technologie_print_machine_fk → shared_machines");
  }
}

async function seedDefaults(conn) {
  const defaults = [
    { name: "XL 105", machine_group: "press", sort_order: 0 },
    { name: "XL 106", machine_group: "press", sort_order: 1 },
    { name: "XL105/106", machine_group: "press", sort_order: 2 },
  ];
  for (const d of defaults) {
    const id = await findOrCreateMachine(conn, { ...d, is_active: true });
    console.log(`Seed: ${d.name} → id ${id}`);
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
    await ensureSharedTable(conn);
    await migrateVykresyMachines(conn);
    await migrateTechnologiePrintMachines(conn);
    await seedDefaults(conn);
    console.log("\nMigrace společného číselníku strojů dokončena.");
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
