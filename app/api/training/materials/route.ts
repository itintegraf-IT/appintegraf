import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import {
  getMaterialFiles,
  serializeMaterial,
  validateMaterialPayload,
} from "@/lib/training/material-api";
import { parseMaterialType } from "@/lib/training/material-types";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "training", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const materials = await prisma.learning_materials.findMany({
    include: { question_categories: { select: { id: true, name: true, code: true, color: true } } },
    orderBy: { title: "asc" },
  });

  const fileMap = await getMaterialFiles(materials.map((m) => m.id));

  return NextResponse.json({
    materials: materials.map((m) => serializeMaterial(m, fileMap.get(m.id) ?? null)),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "training", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění spravovat materiály" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const materialType = parseMaterialType(body.material_type);
    const hasFile = Boolean(body.has_file);

    const validated = validateMaterialPayload(
      {
        title: body.title,
        content: body.content,
        source: body.source,
        category_id: body.category_id != null ? parseInt(String(body.category_id), 10) : null,
        material_type: materialType,
        media_url: body.media_url,
      },
      { isCreate: true, hasFile }
    );

    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const categoryId = validated.data.category_id;
    const created = await prisma.learning_materials.create({
      data: {
        title: validated.data.title!,
        content: validated.data.content ?? "",
        material_type: materialType,
        media_url: materialType === "video" ? validated.data.media_url ?? null : null,
        category_id: categoryId != null && !isNaN(categoryId) ? categoryId : null,
        source:
          validated.data.source !== undefined
            ? String(validated.data.source).trim() || null
            : null,
      },
    });

    return NextResponse.json({ success: true, id: created.id });
  } catch (e) {
    console.error("Training material POST error:", e);
    return NextResponse.json({ error: "Chyba při vytváření materiálu" }, { status: 500 });
  }
}
