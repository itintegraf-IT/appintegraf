#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function walk(dir, files = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      if (e === "node_modules" || e === ".next") continue;
      walk(p, files);
    } else if (/\.(tsx?|mjs)$/.test(e)) files.push(p);
  }
  return files;
}

const targets = [
  join(ROOT, "app", "(dashboard)", "crm"),
  join(ROOT, "app", "api", "crm"),
  join(ROOT, "components", "crm"),
  join(ROOT, "lib", "crm"),
];

function fix(content) {
  let s = content;

  // broken double prefixes from port script
  s = s.replaceAll("crm_crm_contacts", "contacts");
  s = s.replaceAll("crm_crm_deals", "deals");
  s = s.replaceAll("prisma.crm_lostReason", "prisma.crm_lost_reasons");
  s = s.replaceAll("prisma.lostReason", "prisma.crm_lost_reasons");

  // session/guards
  s = s.replace(
    /import \{ requireSession \} from "@\/lib\/crm\/session";/g,
    'import { requireCrmRead } from "@/lib/crm/guards";'
  );
  s = s.replace(/await requireSession\(\)/g, "await requireCrmRead()");
  s = s.replace(
    /import \{ requireRole \} from "@\/lib\/crm\/session";/g,
    'import { requireCrmWrite } from "@/lib/crm/guards";'
  );
  s = s.replace(/await requireRole\(\[["']ADMIN["'],\s*["']SALES["']\]\)/g, "await requireCrmWrite()");

  // user selects
  s = s.replaceAll(
    "{ id: true, name: true, email: true, image: true }",
    "{ id: true, first_name: true, last_name: true, email: true }"
  );
  s = s.replaceAll(
    "{ id: true, name: true, email: true }",
    "{ id: true, first_name: true, last_name: true, email: true }"
  );
  s = s.replaceAll(
    "author: { select: { id: true, name: true, email: true } }",
    "author: { select: { id: true, first_name: true, last_name: true, email: true } }"
  );
  s = s.replaceAll(
    "uploader: { select: { id: true, name: true, email: true } }",
    "uploader: { select: { id: true, first_name: true, last_name: true, email: true } }"
  );

  // deal relations
  s = s.replaceAll("dealContacts:", "crm_deal_contacts:");
  s = s.replaceAll(".dealContacts", ".crm_deal_contacts");
  s = s.replaceAll("include: { company:", "include: { crm_companies:");
  s = s.replaceAll(".company.", ".crm_companies.");
  s = s.replaceAll("company: { select:", "crm_companies: { select:");
  s = s.replaceAll("company: true", "crm_companies: true");

  // generateDealNumber tx
  s = s.replaceAll("tx.deal.", "tx.crm_deals.");
  s = s.replaceAll("tx.company.", "tx.crm_companies.");

  return s;
}

let n = 0;
for (const dir of targets) {
  for (const file of walk(dir)) {
    const raw = readFileSync(file, "utf8");
    const out = fix(raw);
    if (out !== raw) {
      writeFileSync(file, out, "utf8");
      n++;
    }
  }
}
console.log(`[fix-crm] updated ${n} files`);
