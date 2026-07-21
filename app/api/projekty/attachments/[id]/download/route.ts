import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/projekty/session";
import { prisma } from "@/lib/projekty/prisma";
import { AppError, isAppError, errorStatus } from "@/lib/projekty/errors";
import { canViewCard } from "@/lib/projekty/rbac";
import { loadCardForRBAC } from "@/lib/projekty/board-rbac";
import { logger } from "@/lib/projekty/logger";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession();
    const { id } = await ctx.params;
    // Zde BLOB `data` VYBÍRÁME (na rozdíl od list/create) — je potřeba pro stažení.
    const a = await prisma.attachment.findUnique({ where: { id } });
    if (!a) throw new AppError("NOT_FOUND", "Příloha nenalezena.");
    if (a.parentType === "CARD") {
      const card = await loadCardForRBAC(a.parentId);
      if (!canViewCard(user, card)) throw new AppError("FORBIDDEN", "Nemáš přístup k této kartě.");
    }
    const buf = a.data; // BLOB z projekty_attachment.data (Uint8Array)
    // RFC 5987/6266: ASCII fallback + filename*=UTF-8'' pro diakritiku a mezery.
    // (Prostý filename="…" prohlížeče nedekódují, takže encodeURIComponent v něm mrší názvy.)
    const asciiName = a.fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
    const utf8Name = encodeURIComponent(a.fileName).replace(
      /['()*]/g,
      (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
    );
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": a.mime,
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
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
