/**
 * Seed výchozích číselníků CRM (kategorie dealů, důvody prohry).
 * Spuštění: node scripts/seed-crm-defaults.mjs
 */
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import dotenv from "dotenv";

dotenv.config();

function cuid() {
  const t = Date.now().toString(36);
  const r = randomBytes(6).toString("hex");
  return `c${t}${r}`.slice(0, 25);
}

const LOST_REASONS = [
  { code: "price", label: "Cena příliš vysoká" },
  { code: "competition", label: "Zvolili konkurenci" },
  { code: "timing", label: "Odloženo, špatný moment" },
  { code: "tech_fit", label: "Technicky nevyhovuje" },
  { code: "no_response", label: "Klient přestal komunikovat" },
  { code: "budget", label: "Klient nemá budget" },
  { code: "other", label: "Jiný důvod" },
];

const DEAL_CATEGORIES = [
  { code: "IML", label: "IML etikety", color: "#F4A261", sort_order: 10 },
  { code: "KA", label: "Kartonové obaly", color: "#2A9D8F", sort_order: 20 },
  { code: "OSTATNI", label: "Ostatní", color: "#A8A8A8", sort_order: 99 },
];

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

function createPrisma() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL není nastaveno");
  const adapter = new PrismaMariaDb(parseDatabaseUrl(url));
  return new PrismaClient({ adapter });
}

async function main() {
  const prisma = createPrisma();
  console.log("[crm-seed] start");

  for (const reason of LOST_REASONS) {
    const existing = await prisma.crm_lost_reasons.findUnique({ where: { code: reason.code } });
    if (existing) {
      await prisma.crm_lost_reasons.update({
        where: { code: reason.code },
        data: { label: reason.label, active: true },
      });
    } else {
      await prisma.crm_lost_reasons.create({
        data: { id: cuid(), ...reason, active: true },
      });
    }
  }
  console.log(`[crm-seed] ${LOST_REASONS.length} lost reasons`);

  for (const cat of DEAL_CATEGORIES) {
    const existing = await prisma.crm_deal_categories.findUnique({ where: { code: cat.code } });
    if (existing) {
      await prisma.crm_deal_categories.update({
        where: { code: cat.code },
        data: { label: cat.label, color: cat.color, sort_order: cat.sort_order, active: true },
      });
    } else {
      await prisma.crm_deal_categories.create({
        data: { id: cuid(), ...cat, active: true },
      });
    }
  }
  console.log(`[crm-seed] ${DEAL_CATEGORIES.length} deal categories`);
  console.log("[crm-seed] done");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[crm-seed] fail", err);
  process.exit(1);
});
