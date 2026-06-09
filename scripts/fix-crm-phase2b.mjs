#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
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

function dedupeGuardImports(s) {
  const symbols = new Set();
  if (/\brequireCrmRead\b/.test(s)) symbols.add("requireCrmRead");
  if (/\brequireCrmWrite\b/.test(s)) symbols.add("requireCrmWrite");
  if (/\brequireCrmAdmin\b/.test(s)) symbols.add("requireCrmAdmin");
  s = s.replace(/import \{[^}]+\} from "@\/lib\/crm\/guards";\r?\n/g, "");
  if (symbols.size) {
    s = `import { ${[...symbols].join(", ")} } from "@/lib/crm/guards";\n` + s;
  }
  return s;
}

function fix(content) {
  let s = content;

  s = dedupeGuardImports(s);

  // broken DealStage renames
  s = s.replaceAll("crm_deal_stageChevrons", "DealStageChevrons");
  s = s.replaceAll("./crm_deal_stageChevrons", "./DealStageChevrons");
  s = s.replaceAll("crm_deal_stageUpdateSchema", "DealStageUpdateSchema");
  s = s.replaceAll("<crm_deal_stageChevrons", "<DealStageChevrons");
  s = s.replaceAll("</crm_deal_stageChevrons", "</DealStageChevrons");

  // logger
  s = s.replaceAll('@/lib/logger', '@/lib/crm/logger');

  // AI summary
  s = s.replace(/import.*DealSummaryCard.*\r?\n/g, "");
  s = s.replace(/<DealSummaryCard[\s\S]*?\/>/g, "");
  s = s.replace(/<DealSummaryCard[\s\S]*?<\/DealSummaryCard>/g, "");

  // Prisma legacy types in components
  s = s.replace(
    /import type \{ Activity, crm_activity_type, AuditLog, User, crm_deal_stage \}/g,
    "import type { crm_activities, crm_activity_type, crm_audit_log, users, crm_deal_stage }"
  );
  s = s.replace(/\bActivity\b(?![\w])/g, (m, offset, str) => {
    if (str.slice(offset - 4, offset) === "crm_") return m;
    if (str.slice(offset, offset + 15) === "ActivityForm") return m;
    if (str.slice(offset, offset + 18) === "ActivityEditDialog") return m;
    if (str.slice(offset, offset + 18) === "ActivityRowActions") return m;
    if (str.slice(offset, offset + 19) === "ActivitiesTimeline") return m;
    return "crm_activities";
  });

  // contact relation on deal
  s = s.replaceAll("contact:", "crm_contacts:");
  s = s.replaceAll(".contact.", ".crm_contacts.");
  s = s.replaceAll("include: { contact", "include: { crm_contacts");

  // owner_id query coerce in validators
  if (s.includes("CompanyListQuerySchema")) {
    s = s.replace(
      /owner_id: z\.number\(\)\.int\(\)\.optional\(\)/,
      "owner_id: z.coerce.number().int().optional()"
    );
    s = s.replace(
      /sortBy: z\.enum\(\["name", "ico", "segment", "updated_at"\]\)/,
      'sortBy: z.enum(["name", "ico", "segment", "updated_at"]).optional()'
    );
  }

  return s;
}

// logger stub
writeFileSync(
  join(ROOT, "lib", "crm", "logger.ts"),
  `export const logger = {
  info: (...args: unknown[]) => console.log(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
};
`,
  "utf8"
);

// useMediaQuery hook
const hooksDir = join(ROOT, "hooks");
writeFileSync(
  join(hooksDir, "useMediaQuery.ts"),
  readFileSync("c:\\Program Files\\Ampps\\www\\CRM\\integraf-crm\\src\\hooks\\useMediaQuery.ts", "utf8"),
  "utf8"
);

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

// Fix DealStageUpdateSchema export name in validators
const dealVal = join(ROOT, "lib", "crm", "validators", "deal.ts");
let dv = readFileSync(dealVal, "utf8");
dv = dv.replace("crm_deal_stageUpdateSchema", "DealStageUpdateSchema");
readFileSync(dealVal); // noop
writeFileSync(dealVal, dv, "utf8");

console.log(`[fix-crm-2b] updated ${n} files`);
