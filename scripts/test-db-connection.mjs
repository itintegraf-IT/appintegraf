#!/usr/bin/env node
/**
 * Test připojení k databázi – spustit: node scripts/test-db-connection.mjs
 * Pomůže ověřit, zda MySQL běží a DATABASE_URL je správná.
 */
import "dotenv/config";
import mariadb from "mariadb";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("❌ DATABASE_URL není nastavena v .env");
  process.exit(1);
}

console.log("🔌 Testuji připojení k databázi...");

try {
  const u = new URL(url.replace(/^mysql:\/\//, "http://"));
  const conn = await mariadb.createConnection({
    host: u.hostname || "localhost",
    port: u.port ? parseInt(u.port, 10) : 3306,
    user: u.username || "root",
    password: u.password || "",
    database: u.pathname?.replace(/^\//, "").split("?")[0] || "appintegraf",
    connectTimeout: 10000,
    allowPublicKeyRetrieval: true,
  });
  const rows = await conn.query("SELECT 1 as ok, VERSION() as version");
  console.log("✅ Připojení OK:", rows[0]);
  await conn.end();
  process.exit(0);
} catch (err) {
  console.error("❌ Chyba připojení:", err.message);
  console.error("\nZkontrolujte:");
  console.error("  1. Běží MySQL/MariaDB (např. AMPPS Control Panel)?");
  console.error("  2. Je DATABASE_URL v .env správná?");
  console.error("  3. Host: localhost nebo 127.0.0.1");
  process.exit(1);
}
