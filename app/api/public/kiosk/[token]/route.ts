import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { publicKioskSlideFileUrl } from "@/lib/kiosk/files";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const token = (await params).token?.trim();
  if (!token) {
    return NextResponse.json({ error: "Neplatný token" }, { status: 400 });
  }

  const presentation = await prisma.presentations.findFirst({
    where: {
      active_url: token,
      is_active: true,
    },
    select: {
      id: true,
      name: true,
      transition_effect: true,
      transition_time: true,
      display_duration: true,
      slides: {
        where: { visible: true },
        orderBy: { sort_order: "asc" },
        select: {
          id: true,
          file_type: true,
          title: true,
          filename: true,
          duration: true,
          transition_effect: true,
          sort_order: true,
        },
      },
    },
  });

  if (!presentation) {
    return NextResponse.json({ error: "Prezentace nenalezena" }, { status: 404 });
  }

  return NextResponse.json({
    name: presentation.name,
    transition_effect: presentation.transition_effect ?? "fade",
    transition_time: presentation.transition_time ?? 5,
    display_duration: presentation.display_duration ?? 10,
    slides: presentation.slides.map((slide) => ({
      ...slide,
      url: publicKioskSlideFileUrl(token, slide.id),
    })),
  });
}
