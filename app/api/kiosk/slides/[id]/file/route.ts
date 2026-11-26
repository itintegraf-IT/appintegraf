import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { serveKioskSlideFile } from "@/lib/kiosk/files";

/** Admin náhled / stažení snímku z disku (ne přes static /uploads). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const slide = await prisma.slides.findUnique({
    where: { id },
    select: { file_path: true, file_type: true, filename: true },
  });
  if (!slide) {
    return NextResponse.json({ error: "Snímek nenalezen" }, { status: 404 });
  }

  return serveKioskSlideFile(slide);
}
