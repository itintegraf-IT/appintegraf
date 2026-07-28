import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";

async function requireWrite(): Promise<{ userId: number } | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "training", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění spravovat materiály" }, { status: 403 });
  }
  return { userId };
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireWrite();
  if (access instanceof NextResponse) return access;

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

  try {
    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (body.title !== undefined) {
      const title = String(body.title).trim();
      if (!title) return NextResponse.json({ error: "Název nesmí být prázdný" }, { status: 400 });
      data.title = title;
    }
    if (body.content !== undefined) {
      const content = String(body.content).trim();
      if (!content) return NextResponse.json({ error: "Obsah nesmí být prázdný" }, { status: 400 });
      data.content = content;
    }
    if (body.category_id !== undefined) {
      const categoryId = parseInt(String(body.category_id), 10);
      data.category_id = isNaN(categoryId) ? null : categoryId;
    }
    if (body.source !== undefined) data.source = String(body.source).trim() || null;
    data.updated_at = new Date();

    await prisma.learning_materials.update({ where: { id }, data });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Training material PUT error:", e);
    return NextResponse.json({ error: "Chyba při ukládání materiálu" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireWrite();
  if (access instanceof NextResponse) return access;

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

  try {
    await prisma.learning_materials.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Training material DELETE error:", e);
    return NextResponse.json({ error: "Chyba při mazání materiálu" }, { status: 500 });
  }
}
