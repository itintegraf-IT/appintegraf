#!/usr/bin/env node
/**
 * Rozešle nezveřejněné systémové novinky z data/release-notes.json do in-app notifikací.
 *
 * Vyžaduje DATABASE_URL (.env) a tabulku system_release_announcements
 * (prisma/migrations/20261111_system_release_announcements.sql).
 *
 * Spuštění:
 *   node scripts/announce-release.mjs
 *   node scripts/announce-release.mjs --dry-run
 *   node scripts/announce-release.mjs --force
 *   npm run announce:release
 *   npm run announce:release -- --force
 */
import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(ROOT, ".env") });

function parseDatabaseUrl(url) {
  const u = new URL(url.replace(/^mysql:\/\//, "http://"));
  const database = u.pathname?.replace(/^\//, "").split(/[?#]/)[0] || undefined;
  return {
    host: u.hostname || "localhost",
    port: u.port ? parseInt(u.port, 10) : 3306,
    user: u.username || undefined,
    password: u.password || undefined,
    database,
    connectionLimit: 3,
    connectTimeout: 15000,
    allowPublicKeyRetrieval: true,
  };
}

/** Bezpečný popis DB pro log (bez hesla). */
function databaseLabel(url) {
  try {
    const cfg = parseDatabaseUrl(url);
    return `${cfg.host}:${cfg.port}/${cfg.database || "?"}`;
  } catch {
    return "(nepodařilo se parsovat DATABASE_URL)";
  }
}

function gitSha() {
  try {
    return execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("CHYBA: Chybí DATABASE_URL (.env).");
    process.exit(1);
  }

  const notesPath = path.join(ROOT, "data", "release-notes.json");
  if (!existsSync(notesPath)) {
    console.log("Soubor data/release-notes.json neexistuje — nic k oznámení.");
    return;
  }

  const coreUrl = pathToFileURL(
    path.join(ROOT, "lib", "system-update-announce-core.mjs")
  ).href;
  const {
    parseReleaseNotesJson,
    announcePendingReleases,
  } = await import(coreUrl);

  const raw = readFileSync(notesPath, "utf8");
  const parsed = parseReleaseNotesJson(raw);
  if (!parsed.ok) {
    console.error(`CHYBA: release-notes.json: ${parsed.error}`);
    process.exit(1);
  }

  if (parsed.data.releases.length === 0) {
    console.log("Žádné release v data/release-notes.json.");
    return;
  }

  const dbLabel = databaseLabel(url);
  console.log(`announce-release: db=${dbLabel}${dryRun ? " dry-run" : ""}${force ? " force" : ""}`);

  const adapter = new PrismaMariaDb(parseDatabaseUrl(url));
  const prisma = new PrismaClient({ adapter });

  try {
    const result = await announcePendingReleases(prisma, {
      releases: parsed.data.releases,
      gitSha: gitSha(),
      dryRun,
      force,
      databaseLabel: dbLabel,
      log: (msg) => console.log(`  ${msg}`),
    });

    console.log(
      dryRun
        ? `Dry-run hotov: ${result.announced.length} release, ${result.totalRecipients} příjemců (celkem).`
        : `Hotovo: oznámeno ${result.announced.length} release, ${result.totalRecipients} notifikací.`
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/system_release_announcements/i.test(msg) || /P2021|does not exist|Exist/i.test(msg)) {
      console.error(
        "CHYBA: Tabulka system_release_announcements chybí. Nejdřív aplikujte SQL:"
      );
      console.error(
        "  ./scripts/deploy-server.sh --apply-sql 20261111_system_release_announcements.sql"
      );
      console.error("  nebo: npm run db:system-release-announcements");
    }
    console.error("!!! NOVINKY SE NEODESLALY");
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("!!! NOVINKY SE NEODESLALY");
  console.error(e);
  process.exit(1);
});
