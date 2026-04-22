#!/usr/bin/env node
/**
 * IML newsec – Fáze 1: Data-migration skript
 *
 * Převádí legacy data na nové tabulky přidané migrací `20260422074554_iml_newsec_phase1`:
 *   1) iml_customers.shipping_address (TEXT)  →  iml_customer_shipping_addresses (is_default=true)
 *   2) iml_products.foil_type         (TEXT)  →  iml_foils (dedup) + nastavení iml_products.foil_id
 *   3) iml_products.pdf_data          (BLOB)  →  iml_product_files verze 1 (is_primary=true)
 *
 * Vlastnosti:
 *   • Idempotentní – druhý běh reportuje "0 nových záznamů"
 *   • Pojistka: pracuje VÝHRADNĚ s `iml_*` tabulkami (+ read-only dotaz do users pro admin ID)
 *   • Nevytváří záznamy v `audit_log` (legacy migrace, ne uživatelská akce – viz docs/IML_NEWSEC_IMPLEMENTATION.md 1.3)
 *   • Flag --dry-run – pouze reportuje, nic nezapisuje
 *
 * Spuštění:
 *   node scripts/iml-newsec-phase1-migrate.mjs --dry-run   (suchý běh)
 *   node scripts/iml-newsec-phase1-migrate.mjs              (ostrý běh)
 *
 * Před ostrým spuštěním: záloha DB v backups/ (viz docs/IML_NEWSEC_IMPLEMENTATION.md 0.3.6).
 */
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import dotenv from "dotenv";

dotenv.config();

const DRY_RUN = process.argv.includes("--dry-run");
const VERBOSE = process.argv.includes("--verbose") || DRY_RUN;

function parseDatabaseUrl(url) {
  const u = new URL(url.replace(/^mysql:\/\//, "http://"));
  return {
    host: u.hostname || "localhost",
    port: u.port ? parseInt(u.port, 10) : 3306,
    user: u.username || undefined,
    password: u.password || undefined,
    database: u.pathname?.replace(/^\//, "").split("?")[0] || undefined,
    connectionLimit: 5,
    connectTimeout: 15000,
    allowPublicKeyRetrieval: true,
  };
}

/** Normalizace fólie na unikátní kód (uppercase, bez mezer/diakritiky). */
function foilCodeFromName(raw) {
  if (!raw) return null;
  const norm = String(raw)
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  return norm.slice(0, 50) || null;
}

async function findDefaultAdminId(prisma) {
  // MySQL collation utf8mb4_unicode_ci je case-insensitive → stačí jedno porovnání.
  const admin = await prisma.users.findFirst({
    where: {
      is_active: true,
      roles: { name: "admin" },
    },
    orderBy: { id: "asc" },
    select: { id: true, username: true },
  });
  if (!admin) {
    throw new Error("Nenalezen žádný aktivní admin v tabulce `users` – nelze nastavit uploaded_by pro iml_product_files.");
  }
  return admin;
}

/** KROK 1 – iml_customers.shipping_address → iml_customer_shipping_addresses */
async function migrateShippingAddresses(prisma, dryRun) {
  console.log("\n[KROK 1] iml_customers.shipping_address → iml_customer_shipping_addresses");

  const candidates = await prisma.iml_customers.findMany({
    where: { shipping_address: { not: null } },
    select: {
      id: true,
      name: true,
      shipping_address: true,
      city: true,
      postal_code: true,
      country: true,
    },
  });

  const nonEmpty = candidates.filter((c) => c.shipping_address && c.shipping_address.trim() !== "");

  if (nonEmpty.length === 0) {
    console.log("  → žádní zákazníci s vyplněnou shipping_address, přeskočeno.");
    return { scanned: candidates.length, created: 0, skipped: 0 };
  }

  let created = 0;
  let skipped = 0;

  for (const c of nonEmpty) {
    const existingDefault = await prisma.iml_customer_shipping_addresses.findFirst({
      where: { customer_id: c.id, is_default: true },
      select: { id: true },
    });

    if (existingDefault) {
      skipped++;
      if (VERBOSE) {
        console.log(`  ≡ zákazník #${c.id} (${c.name}) už má výchozí adresu #${existingDefault.id} – přeskočeno`);
      }
      continue;
    }

    const payload = {
      customer_id: c.id,
      label: "Výchozí (migrace)",
      recipient: c.name,
      street: c.shipping_address.trim(),
      city: c.city ?? null,
      postal_code: c.postal_code ?? null,
      country: c.country ?? "Česká republika",
      is_default: true,
    };

    if (dryRun) {
      console.log(`  [dry-run] +zákazník #${c.id} (${c.name}): adresa "${payload.street.slice(0, 60)}…"`);
    } else {
      const row = await prisma.iml_customer_shipping_addresses.create({ data: payload, select: { id: true } });
      console.log(`  + zákazník #${c.id} (${c.name}): vytvořena adresa #${row.id}`);
    }
    created++;
  }

  return { scanned: candidates.length, created, skipped };
}

/** KROK 2 – iml_products.foil_type → iml_foils (dedup) + set iml_products.foil_id */
async function migrateFoils(prisma, dryRun) {
  console.log("\n[KROK 2] iml_products.foil_type → iml_foils (dedup) + foil_id");

  const distinct = await prisma.iml_products.groupBy({
    by: ["foil_type"],
    where: { foil_type: { not: null } },
    _count: { _all: true },
  });

  const usable = distinct
    .map((d) => ({ foil_type: d.foil_type?.trim() ?? "", count: d._count._all }))
    .filter((d) => d.foil_type !== "");

  if (usable.length === 0) {
    console.log("  → žádné produkty s foil_type, přeskočeno.");
    return { foilsCreated: 0, foilsReused: 0, productsLinked: 0 };
  }

  let foilsCreated = 0;
  let foilsReused = 0;
  let productsLinked = 0;

  for (const { foil_type: name, count } of usable) {
    const code = foilCodeFromName(name);
    if (!code) {
      console.log(`  ! přeskočeno "${name}" – nelze odvodit unikátní kód`);
      continue;
    }

    let foil = await prisma.iml_foils.findUnique({ where: { code }, select: { id: true } });

    if (!foil) {
      if (dryRun) {
        console.log(`  [dry-run] +fólie { code="${code}", name="${name}" } (používána u ${count} produktů)`);
        foilsCreated++;
        continue;
      }
      foil = await prisma.iml_foils.create({
        data: { code, name, note: "Auto-migrováno z iml_products.foil_type (fáze 1)" },
        select: { id: true },
      });
      console.log(`  + fólie #${foil.id} { code="${code}", name="${name}" }`);
      foilsCreated++;
    } else {
      foilsReused++;
      if (VERBOSE) console.log(`  ≡ fólie "${code}" už existuje (#${foil.id})`);
    }

    if (dryRun) {
      console.log(`  [dry-run] → nastavit foil_id pro ~${count} produktů s foil_type="${name}" (pouze pokud jsou foil_id NULL)`);
      productsLinked += count;
      continue;
    }

    const result = await prisma.iml_products.updateMany({
      where: { foil_type: name, foil_id: null },
      data: { foil_id: foil.id },
    });
    if (result.count > 0) {
      console.log(`  → ${result.count} produkt(ů) napojeno na fólii #${foil.id}`);
      productsLinked += result.count;
    }
  }

  return { foilsCreated, foilsReused, productsLinked };
}

/** KROK 3 – iml_products.pdf_data → iml_product_files verze 1 */
async function migrateProductPdfs(prisma, dryRun, adminId) {
  console.log("\n[KROK 3] iml_products.pdf_data → iml_product_files (verze 1)");

  const products = await prisma.iml_products.findMany({
    where: { pdf_data: { not: null } },
    select: { id: true, ig_code: true, ig_short_name: true, pdf_data: true },
  });

  if (products.length === 0) {
    console.log("  → žádné produkty s pdf_data, přeskočeno.");
    return { scanned: 0, created: 0, skipped: 0 };
  }

  let created = 0;
  let skipped = 0;

  for (const p of products) {
    const existing = await prisma.iml_product_files.findFirst({
      where: { product_id: p.id },
      select: { id: true, version: true },
    });
    if (existing) {
      skipped++;
      if (VERBOSE) {
        console.log(`  ≡ produkt #${p.id} (${p.ig_code ?? p.ig_short_name ?? "?"}) už má verzi #${existing.version} – přeskočeno`);
      }
      continue;
    }

    const size = p.pdf_data ? Buffer.byteLength(p.pdf_data) : 0;

    if (dryRun) {
      console.log(`  [dry-run] +produkt #${p.id} (${p.ig_code ?? "?"}): vytvoří verzi 1, ${(size / 1024).toFixed(1)} kB`);
      created++;
      continue;
    }

    const row = await prisma.iml_product_files.create({
      data: {
        product_id: p.id,
        version: 1,
        filename: "legacy.pdf",
        file_size: size,
        mime_type: "application/pdf",
        pdf_data: p.pdf_data,
        is_primary: true,
        uploaded_by: adminId,
      },
      select: { id: true },
    });
    console.log(`  + produkt #${p.id} (${p.ig_code ?? "?"}): verze 1 → iml_product_files #${row.id} (${(size / 1024).toFixed(1)} kB)`);
    created++;
  }

  return { scanned: products.length, created, skipped };
}

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ DATABASE_URL není nastavena. Zkontrolujte .env");
    process.exit(1);
  }

  const adapter = new PrismaMariaDb(parseDatabaseUrl(url));
  const prisma = new PrismaClient({ adapter });

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  IML newsec – Fáze 1: Data-migration                     ║");
  console.log(`║  Režim: ${DRY_RUN ? "DRY-RUN (žádný zápis)".padEnd(49) : "OSTRÝ BĚH (zápis do DB)".padEnd(49)}║`);
  console.log("╚══════════════════════════════════════════════════════════╝");

  try {
    const admin = await findDefaultAdminId(prisma);
    console.log(`✓ Výchozí admin pro uploaded_by: #${admin.id} (${admin.username})`);

    const r1 = await migrateShippingAddresses(prisma, DRY_RUN);
    const r2 = await migrateFoils(prisma, DRY_RUN);
    const r3 = await migrateProductPdfs(prisma, DRY_RUN, admin.id);

    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("SOUHRN");
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`  KROK 1 (shipping_address):   ${r1.created} vytvořeno, ${r1.skipped} přeskočeno (scan: ${r1.scanned})`);
    console.log(`  KROK 2 (foil_type):          ${r2.foilsCreated} nových fólií, ${r2.foilsReused} použito existujících, ${r2.productsLinked} produkt(ů) napojeno`);
    console.log(`  KROK 3 (pdf_data):           ${r3.created} vytvořeno, ${r3.skipped} přeskočeno (scan: ${r3.scanned})`);

    if (DRY_RUN) {
      console.log("\n⚠  DRY-RUN – žádná data nebyla zapsána. Pro ostrý běh spusťte bez --dry-run.");
    } else {
      console.log("\n✅ Migrace dokončena.");
    }
  } catch (err) {
    console.error("\n❌ Chyba:", err.message);
    if (VERBOSE && err.stack) console.error(err.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
