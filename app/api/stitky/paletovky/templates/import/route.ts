import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAdministerStitky } from "@/lib/stitky/access";
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

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Očekáván multipart upload" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Chybí soubor" }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  if (!name.endsWith(".xls") && !name.endsWith(".xlsx")) {
    return NextResponse.json({ error: "Povolené formáty: .xls, .xlsx" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parsePaletovkaXlsBuffer(buffer, file.name);
    return NextResponse.json({
      preview: {
        name: parsed.name,
        layoutVariant: parsed.layoutVariant,
        blocksPerPage: parsed.blocksPerPage,
        layoutJson: parsed.layoutJson,
        defaultsJson: parsed.defaults,
        sourceFilename: file.name,
        warnings: parsed.warnings,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Import selhal";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
