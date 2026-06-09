#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function walk(dir, files = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      if (["node_modules", ".next"].includes(e)) continue;
      walk(p, files);
    } else if (/\.(tsx?)$/.test(e)) files.push(p);
  }
  return files;
}

const dirs = [
  join(ROOT, "app", "(dashboard)", "crm"),
  join(ROOT, "app", "api", "crm"),
  join(ROOT, "components", "crm"),
  join(ROOT, "lib", "crm"),
];

function fix(content) {
  let s = content;

  // wrong relation renames — keep prisma.crm_companies, fix includes
  s = s.replace(/include:\s*\{\s*crm_companies:/g, "include: { company:");
  s = s.replace(/include:\s*\{\s*crm_companies\s*,/g, "include: { company,");
  s = s.replace(/\.crm_companies\./g, ".company.");
  s = s.replace(/contact\.crm_companies/g, "contact.company");
  s = s.replace(/deal\.crm_companies/g, "deal.company");

  // lost reasons model
  s = s.replaceAll("prisma.lost_reason", "prisma.crm_lost_reasons");

  // user select leftovers
  s = s.replaceAll("{ name: true, email: true }", "{ first_name: true, last_name: true, email: true }");
  s = s.replaceAll("{ select: { name: true, email: true } }", "{ select: { first_name: true, last_name: true, email: true } }");

  // broken lucide import in ActivitiesTimeline
  s = s.replace(
    /crm_activities as ActivityIcon/g,
    "Activity as ActivityIcon"
  );

  return s;
}

let n = 0;
for (const dir of dirs) {
  for (const file of walk(dir)) {
    const raw = readFileSync(file, "utf8");
    const out = fix(raw);
    if (out !== raw) {
      writeFileSync(file, out, "utf8");
      n++;
    }
  }
}

// ActivitiesTimeline types
const timeline = join(ROOT, "components", "crm", "ActivitiesTimeline.tsx");
let t = readFileSync(timeline, "utf8");
t = t.replace(
  `type TimelineActivity = {
  id: string;
  type: crm_activity_type;
  date: Date | string;
  duration: number | null;
  note: string | null;
  outcome: string | null;
  next_action_date: Date | string | null;
  completed_at?: Date | string | null;
  owner_id: string;
  assignee_id: string | null;
  owner: { id: string; name: string | null; email: string | null; image: string | null } | null;
  assignee: { id: string; name: string | null; email: string | null; image: string | null } | null;
};

type CurrentUser = { id: string; role: Role };
type UserOption = { id: string; name: string | null; email: string | null };`,
  `type CrmPerson = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type TimelineActivity = {
  id: string;
  type: crm_activity_type;
  date: Date | string;
  duration: number | null;
  note: string | null;
  outcome: string | null;
  next_action_date: Date | string | null;
  completed_at?: Date | string | null;
  owner_id: number;
  assignee_id: number | null;
  owner: CrmPerson | null;
  assignee: CrmPerson | null;
};

type CurrentUser = { id: number; role: Role };
type UserOption = CrmPerson;`
);
writeFileSync(timeline, t, "utf8");

// activity permissions
const actPerm = join(ROOT, "lib", "crm", "permissions", "activity.ts");
let ap = readFileSync(actPerm, "utf8");
ap = ap.replaceAll("ownerId: string", "owner_id: number");
ap = ap.replaceAll("user.id", "user.id");
ap = ap.replace(/ownerId/g, "owner_id");
writeFileSync(actPerm, ap, "utf8");

console.log(`[fix-crm-2c] updated ${n} files + timeline + activity perms`);
