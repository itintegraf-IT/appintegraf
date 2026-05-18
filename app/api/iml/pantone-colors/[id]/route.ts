import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { findMaterialForImlLegacyId, toImlPantoneShape } from "@/lib/materialy/iml-compat";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  const row = await findMaterialForImlLegacyId("COLOR", "iml_pantone_colors", id);
  if (!row) return NextResponse.json({ error: "Barva nenalezena" }, { status: 404 });

  return NextResponse.json({ pantone_color: toImlPantoneShape(row), color: toImlPantoneShape(row) });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  const existing = await findMaterialForImlLegacyId("COLOR", "iml_pantone_colors", id);
  if (!existing) return NextResponse.json({ error: "Barva nenalezena" }, { status: 404 });

  const body = await req.json();
  const row = await prisma.materials.update({
    where: { id: existing.id },
    data: {
      name: body.name != null ? String(body.name).trim() : existing.name,
      code:
        body.code !== undefined
          ? body.code
            ? String(body.code).trim()
            : null
          : body.pantone_code !== undefined
            ? body.pantone_code
              ? String(body.pantone_code).trim()
              : null
            : existing.code,
      description:
        body.description !== undefined
          ? body.description
            ? String(body.description).trim()
            : null
          : existing.description,
      is_active: body.is_active !== undefined ? !!body.is_active : existing.is_active,
    },
  });

  return NextResponse.json({ pantone_color: toImlPantoneShape(row), color: toImlPantoneShape(row) });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  const existing = await findMaterialForImlLegacyId("COLOR", "iml_pantone_colors", id);
  if (!existing) return NextResponse.json({ error: "Barva nenalezena" }, { status: 404 });

  await prisma.materials.update({ where: { id: existing.id }, data: { is_active: false } });
  return NextResponse.json({ success: true });
}
