import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { deleteMaterialUploads } from "@/lib/training/material-upload";
import { getMaterialFile, validateMaterialPayload } from "@/lib/training/material-api";
import { parseMaterialType } from "@/lib/training/material-types";

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
    const existing = await prisma.learning_materials.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Materiál nenalezen" }, { status: 404 });
    }

    const body = await req.json();
    const existingFile = await getMaterialFile(id);
    const hasFile = Boolean(body.has_file) || existingFile !== null;

    const materialType =
      body.material_type !== undefined
        ? parseMaterialType(body.material_type)
        : parseMaterialType(existing.material_type);

    const validated = validateMaterialPayload(
      {
        title: body.title ?? existing.title,
        content: body.content !== undefined ? body.content : existing.content,
        source: body.source,
        category_id:
          body.category_id !== undefined
            ? body.category_id != null
              ? parseInt(String(body.category_id), 10)
              : null
            : existing.category_id,
        material_type: materialType,
        media_url: body.media_url !== undefined ? body.media_url : existing.media_url,
      },
      { isCreate: false, hasFile }
    );

    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const data: Record<string, unknown> = { updated_at: new Date() };

    if (body.title !== undefined) data.title = validated.data.title;
    if (body.content !== undefined) data.content = validated.data.content ?? "";
    if (body.category_id !== undefined) {
      const categoryId = validated.data.category_id;
      data.category_id = categoryId != null && !isNaN(categoryId) ? categoryId : null;
    }
    if (body.source !== undefined) {
      data.source =
        validated.data.source !== undefined
          ? String(validated.data.source).trim() || null
          : null;
    }
    if (body.material_type !== undefined) {
      data.material_type = materialType;
      if (materialType !== "video") data.media_url = null;
    }
    if (body.media_url !== undefined && materialType === "video") {
      data.media_url = validated.data.media_url ?? null;
    }

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
    await deleteMaterialUploads(id);
    await prisma.learning_materials.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Training material DELETE error:", e);
    return NextResponse.json({ error: "Chyba při mazání materiálu" }, { status: 500 });
  }
}
