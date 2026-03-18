#!/usr/bin/env node
/**
 * Migrace plaintext hesel (password_custom) na bcrypt hash (password_hash).
 *
 * Spuštění: node scripts/migrate-passwords-to-hash.mjs
 * Nebo: npm run migrate:passwords
 *
 * Před spuštěním: záloha databáze!
 */
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

function parseDatabaseUrl(url) {
  const u = new URL(url.replace(/^mysql:\/\//, "http://"));
  const database = u.pathname?.replace(/^\//, "").split("?")[0] || undefined;
  return {
    host: u.hostname || "localhost",
    port: u.port ? parseInt(u.port, 10) : 3306,
    user: u.username || undefined,
    password: u.password || undefined,
    database,
    connectionLimit: 5,
    connectTimeout: 15000,
    allowPublicKeyRetrieval: true,
  };
}

function isBcryptHash(str) {
  return (
    str &&
    typeof str === "string" &&
    (str.startsWith("$2a$") || str.startsWith("$2b$") || str.startsWith("$2y$"))
  );
}

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ DATABASE_URL není nastavena. Zkontrolujte .env");
    process.exit(1);
  }

  const poolConfig = parseDatabaseUrl(url);
  const adapter = new PrismaMariaDb(poolConfig);
  const prisma = new PrismaClient({ adapter });

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  Migrace hesel: plaintext → bcrypt hash                  ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("");

  try {
    const users = await prisma.users.findMany({
      where: { password_custom: { not: null } },
      select: { id: true, username: true, password_hash: true, password_custom: true },
    });

    const toMigrate = users.filter(
      (u) => u.password_custom && String(u.password_custom).trim() !== ""
    );

    if (toMigrate.length === 0) {
      console.log("✓ Žádní uživatelé s plaintext heslem – migrace není potřeba.");
      return;
    }

    console.log(`Nalezeno ${toMigrate.length} uživatelů s plaintext heslem:`);
    console.log("");

    let migrated = 0;
    let cleared = 0;

    for (const user of toMigrate) {
      const hasValidHash = isBcryptHash(user.password_hash);

      if (hasValidHash) {
        await prisma.users.update({
          where: { id: user.id },
          data: { password_custom: null },
        });
        console.log(`  [${user.username}] vymazán plaintext (již měl hash)`);
        cleared++;
      } else {
        const hash = await bcrypt.hash(user.password_custom, 10);
        await prisma.users.update({
          where: { id: user.id },
          data: { password_hash: hash, password_custom: null },
        });
        console.log(`  [${user.username}] plaintext → bcrypt hash`);
        migrated++;
      }
    }

    console.log("");
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`✅ Migrace dokončena: ${migrated} převedeno na hash, ${cleared} vymazáno plaintext`);
    console.log("═══════════════════════════════════════════════════════════");
    console.log("");
    console.log("Další krok: restartujte aplikaci (auth.ts a profile route již nepoužívají plaintext).");
  } catch (err) {
    console.error("");
    console.error("❌ Chyba:", err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
