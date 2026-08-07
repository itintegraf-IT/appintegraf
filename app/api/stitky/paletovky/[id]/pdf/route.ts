import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canReadStitky } from "@/lib/stitky/access";
import { logPaletovkaAudit } from "@/lib/stitky/paletovky/audit";
import { buildPaletovkaPdf, paletovkaPdfFilename } from "@/lib/stitky/paletovky/pdf-paletovka";
import {
  parsePaletovkaDocumentData,
  parsePaletovkaLayoutJson,
  type PaletovkaLayoutVariant,
} from "@/lib/stitky/paletovky/types";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canReadStitky(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await ctx.params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const row = await prisma.stitky_paletovky.findUnique({
    where: { id },
    include: { template: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Paletovka nenalezena" }, { status: 404 });
  }

  const data = parsePaletovkaDocumentData(row.data_json);
  if (!data) {
    return NextResponse.json({ error: "Neplatná data" }, { status: 500 });
  }

  const layoutJson = parsePaletovkaLayoutJson(row.template.layout_json);
  const variant = (row.template.layout_variant as PaletovkaLayoutVariant) ?? "single";

  try {
    const bytes = await buildPaletovkaPdf(data, variant, layoutJson);
    const filename = paletovkaPdfFilename(row.title, row.id);

    if (row.status === "DRAFT") {
      await prisma.stitky_paletovky.update({
        where: { id },
        data: { status: "PRINTED" },
      });
    }

    await logPaletovkaAudit({ userId, recordId: id, action: "PDF_EXPORT" });

    const encoded = encodeURIComponent(filename);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encoded}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("GET paletovky pdf", e);
    return NextResponse.json({ error: "Generování PDF selhalo" }, { status: 500 });
  }
}
