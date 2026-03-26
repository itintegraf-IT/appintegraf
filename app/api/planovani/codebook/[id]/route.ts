import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getPlanovaniRole } from "@/lib/planovani-auth";
import { parseBadgeColor } from "@/lib/badgeColors";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getPlanovaniRole(parseInt(session.user.id, 10));
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const numId = Number(id);
  if (isNaN(numId)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

  try {
    const body = await request.json();
    let badgeColorUpdate: { badgeColor: string | null } | undefined;
    if (body.badgeColor !== undefined) {
      const parsed = parseBadgeColor(body.badgeColor);
      if ("error" in parsed) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      badgeColorUpdate = { badgeColor: parsed.color };
    }
    const updated = await prisma.planovani_codebook_options.update({
      where: { id: numId },
      data: {
        ...(body.label !== undefined && { label: String(body.label) }),
        ...(body.isWarning !== undefined && { isWarning: Boolean(body.isWarning) }),
        ...(body.isActive !== undefined && { isActive: Boolean(body.isActive) }),
        ...(body.shortCode !== undefined && { shortCode: body.shortCode }),
        ...(body.sortOrder !== undefined && { sortOrder: Number(body.sortOrder) }),
        ...badgeColorUpdate,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update codebook option failed", error);
    return NextResponse.json({ error: "Chyba při ukládání" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getPlanovaniRole(parseInt(session.user.id, 10));
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const numId = Number(id);
  if (isNaN(numId)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

  try {
    await prisma.planovani_codebook_options.delete({ where: { id: numId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete codebook option failed", error);
    return NextResponse.json({ error: "Chyba při mazání" }, { status: 500 });
  }
}
