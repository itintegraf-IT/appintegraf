import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serveKioskSlideFile } from "@/lib/kiosk/files";

/** Veřejné médium pro RPi — jen slide aktivní prezentace s daným tokenem. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string; slideId: string }> }
) {
  const { token: rawToken, slideId: slideIdParam } = await params;
  const token = rawToken?.trim();
  const slideId = parseInt(slideIdParam, 10);

  if (!token || Number.isNaN(slideId)) {
    return NextResponse.json({ error: "Neplatný požadavek" }, { status: 400 });
  }

  const presentation = await prisma.presentations.findFirst({
    where: { active_url: token, is_active: true },
    select: { id: true },
  });
  if (!presentation) {
    return NextResponse.json({ error: "Prezentace nenalezena" }, { status: 404 });
  }

  const slide = await prisma.slides.findFirst({
    where: {
      id: slideId,
      presentation_id: presentation.id,
      visible: true,
    },
    select: { file_path: true, file_type: true, filename: true },
  });
  if (!slide) {
    return NextResponse.json({ error: "Snímek nenalezen" }, { status: 404 });
  }

  return serveKioskSlideFile(slide);
}
