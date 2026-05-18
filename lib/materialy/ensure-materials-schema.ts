import { prisma } from "@/lib/db";

let ensured = false;

const COLUMNS: Array<{ name: string; ddl: string }> = [
  {
    name: "certificate_valid_until",
    ddl: "ALTER TABLE `materials` ADD COLUMN `certificate_valid_until` DATETIME NULL",
  },
  {
    name: "thickness_label",
    ddl: "ALTER TABLE `materials` ADD COLUMN `thickness_label` VARCHAR(80) NULL",
  },
  { name: "hex_color", ddl: "ALTER TABLE `materials` ADD COLUMN `hex_color` VARCHAR(7) NULL" },
  { name: "cmyk_c", ddl: "ALTER TABLE `materials` ADD COLUMN `cmyk_c` INT NULL" },
  { name: "cmyk_m", ddl: "ALTER TABLE `materials` ADD COLUMN `cmyk_m` INT NULL" },
  { name: "cmyk_y", ddl: "ALTER TABLE `materials` ADD COLUMN `cmyk_y` INT NULL" },
  { name: "cmyk_k", ddl: "ALTER TABLE `materials` ADD COLUMN `cmyk_k` INT NULL" },
];

async function columnExists(name: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(*) AS cnt
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'materials'
      AND COLUMN_NAME = ${name}
  `;
  return Number(rows[0]?.cnt ?? 0) > 0;
}

/** Doplní sloupce tabulky `materials`, pokud DB vznikla starší migrací bez nich. */
export async function ensureMaterialsTableColumns(): Promise<void> {
  if (ensured) return;

  for (const col of COLUMNS) {
    const exists = await columnExists(col.name);
    if (exists) continue;
    try {
      await prisma.$executeRawUnsafe(col.ddl);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Duplicate column") || msg.includes("1060")) continue;
      throw e;
    }
  }

  ensured = true;
}
