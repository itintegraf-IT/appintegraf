import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { unlink } from "fs/promises";
import path from "path";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const slide = await prisma.slides.findUnique({
    where: { id },
  });

  if (!slide) {
    return NextResponse.json({ error: "Snímek nenalezen" }, { status: 404 });
  }

  // Smazat soubor z disku (pokud je v public/uploads)
  const filePath = slide.file_path;
  if (filePath.startsWith("/uploads/")) {
    const fullPath = path.join(process.cwd(), "public", filePath);
    try {
      await unlink(fullPath);
    } catch {
      // Soubor může už neexistovat
    }
  }

  await prisma.slides.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const slide = await prisma.slides.findUnique({ where: { id } });
  if (!slide) {
    return NextResponse.json({ error: "Snímek nenalezen" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const { title, duration, transition_effect, visible, sort_order } = body;

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = String(title).trim() || null;
    if (duration !== undefined) data.duration = parseInt(String(duration), 10) || 5;
    if (transition_effect !== undefined) data.transition_effect = String(transition_effect) || "fade";
    if (visible !== undefined) data.visible = !!visible;
    if (sort_order !== undefined) data.sort_order = parseInt(String(sort_order), 10) ?? 0;

    await prisma.slides.update({
      where: { id },
      data,
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Slide PUT error:", e);
    return NextResponse.json({ error: "Chyba při ukládání" }, { status: 500 });
  }
}
