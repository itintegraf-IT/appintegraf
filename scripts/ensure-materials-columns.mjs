/**
 * Doplní chybějící sloupce tabulky materials.
 * Spuštění: node scripts/ensure-materials-columns.mjs
 */
import "dotenv/config";
import mariadb from "mariadb";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Chybí DATABASE_URL v .env");
  process.exit(1);
}

const u = new URL(url);
const pool = mariadb.createPool({
  host: u.hostname,
  port: Number(u.port) || 3306,
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  database: u.pathname.replace(/^\//, ""),
});

const COLUMNS = [
  { name: "certificate_valid_until", ddl: "ALTER TABLE `materials` ADD COLUMN `certificate_valid_until` DATETIME NULL" },
  { name: "thickness_label", ddl: "ALTER TABLE `materials` ADD COLUMN `thickness_label` VARCHAR(80) NULL" },
  { name: "hex_color", ddl: "ALTER TABLE `materials` ADD COLUMN `hex_color` VARCHAR(7) NULL" },
  { name: "cmyk_c", ddl: "ALTER TABLE `materials` ADD COLUMN `cmyk_c` INT NULL" },
  { name: "cmyk_m", ddl: "ALTER TABLE `materials` ADD COLUMN `cmyk_m` INT NULL" },
  { name: "cmyk_y", ddl: "ALTER TABLE `materials` ADD COLUMN `cmyk_y` INT NULL" },
  { name: "cmyk_k", ddl: "ALTER TABLE `materials` ADD COLUMN `cmyk_k` INT NULL" },
];

let conn;
try {
  conn = await pool.getConnection();
  const db = u.pathname.replace(/^\//, "");
  for (const col of COLUMNS) {
    const rows = await conn.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'materials' AND COLUMN_NAME = ?`,
      [db, col.name]
    );
    if (Number(rows[0].cnt) > 0) {
      console.log("Skip (exists):", col.name);
      continue;
    }
    await conn.query(col.ddl);
    console.log("Added:", col.name);
  }
  console.log("Hotovo.");
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  if (conn) conn.release();
  await pool.end();
}
