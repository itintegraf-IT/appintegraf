import { requireCrmRead, requireCrmWrite, requireCrmAdmin } from "@/lib/crm/guards";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AppError, isAppError, errorStatus } from "@/lib/crm/errors";
import { canAccessParent } from "@/lib/crm/rbac";
import { readAttachment } from "@/lib/crm/file-storage";
import { logger } from "@/lib/crm/logger";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCrmRead();
    const { id } = await ctx.params;
    const a = await prisma.crm_attachments.findUnique({ where: { id } });
    if (!a) throw new AppError("NOT_FOUND", "Příloha nenalezena.");
    const ok = await canAccessParent(user, a.parent_type, a.parent_id);
    if (!ok) throw new AppError("FORBIDDEN", "Nemáš přístup.");
    const buf = await readAttachment(a.path);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": a.mime,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(a.file_name)}"`,
        "Content-Length": String(a.size),
      },
    });
  } catch (err) {
    if (isAppError(err)) {
      return NextResponse.json({ error: err.message }, { status: errorStatus(err.code) });
    }
    logger.error("[attachments/download] neočekávaná chyba", err as Error);
    return NextResponse.json({ error: "Interní chyba serveru." }, { status: 500 });
  }
}
