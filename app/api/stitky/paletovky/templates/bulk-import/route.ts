import { NextRequest, NextResponse } from "next/server";
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAdministerStitky } from "@/lib/stitky/access";
import { logPaletovkaAudit } from "@/lib/stitky/paletovky/audit";
import { parsePaletovkaXlsBuffer } from "@/lib/stitky/paletovky/xls-import";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAdministerStitky(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const dir =
    String(b.dir ?? process.env.PALETOVKY_TEMPLATES_DIR ?? "").trim() ||
    "\\\\SRV-IGFile\\Management\\Vyroba\\Mistri\\POPIČKY RUDY";
  const limit = Math.min(Number(b.limit ?? 50) || 50, 500);
  const skipExisting = b.skipExisting !== false;

  if (!existsSync(dir)) {
    return NextResponse.json({ error: `Složka nenalezena: ${dir}` }, { status: 400 });
  }

  const files = readdirSync(dir)
    .filter((f) => /\.(xls|xlsx)$/i.test(f) && !f.startsWith("~$"))
    .slice(0, limit);

  const existing = skipExisting
    ? new Set(
        (
          await prisma.stitky_paletovka_templates.findMany({
            select: { source_filename: true, name: true },
          })
        ).flatMap((r) => [r.source_filename, r.name].filter(Boolean) as string[])
      )
    : new Set<string>();

  const results: { file: string; ok: boolean; error?: string; id?: number }[] = [];

  for (const file of files) {
    if (skipExisting && (existing.has(file) || existing.has(file.replace(/\.(xls|xlsx)$/i, "")))) {
      results.push({ file, ok: true, error: "přeskočeno (existuje)" });
      continue;
    }
    try {
      const buffer = readFileSync(join(dir, file));
      const parsed = parsePaletovkaXlsBuffer(buffer, file);
      const row = await prisma.stitky_paletovka_templates.create({
        data: {
          name: parsed.name,
          layout_variant: parsed.layoutVariant,
          blocks_per_page: parsed.blocksPerPage,
          layout_json: parsed.layoutJson,
          defaults_json: parsed.defaults,
          source_filename: file,
          created_by: userId,
        },
      });
      await logPaletovkaAudit({
        userId,
        recordId: row.id,
        tableName: "stitky_paletovka_templates",
        action: "TEMPLATE_BULK_IMPORTED",
        detail: { file },
      });
      results.push({ file, ok: true, id: row.id });
    } catch (e) {
      results.push({
        file,
        ok: false,
        error: e instanceof Error ? e.message : "chyba",
      });
    }
  }

  const imported = results.filter((r) => r.ok && r.id).length;
  return NextResponse.json({
    dir,
    processed: results.length,
    imported,
    results,
  });
}
