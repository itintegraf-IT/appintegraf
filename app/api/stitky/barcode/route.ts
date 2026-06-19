import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canReadStitky } from "@/lib/stitky/access";
import { generateCode128Png } from "@/lib/stitky/barcode";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canReadStitky(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const text = req.nextUrl.searchParams.get("text")?.trim();
  if (!text) {
    return NextResponse.json({ error: "Chybí parametr text" }, { status: 400 });
  }

  try {
    const png = await generateCode128Png(text);
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    console.error("GET /api/stitky/barcode", e);
    return NextResponse.json({ error: "Generování čárového kódu selhalo" }, { status: 500 });
  }
}
