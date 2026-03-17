import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";

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
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { label, field_type, sort_order, is_active } = body;

    const update: Record<string, unknown> = {};
    if (label != null) update.label = String(label).trim();
    if (field_type != null) update.field_type = ["text", "number", "date", "boolean"].includes(field_type) ? field_type : "text";
    if (sort_order != null) update.sort_order = parseInt(String(sort_order), 10) || 0;
    if (is_active != null) update.is_active = !!is_active;

    const field = await prisma.iml_custom_fields.update({
      where: { id },
      data: update,
    });

    return NextResponse.json({ success: true, field });
  } catch (e) {
    console.error("IML custom fields PUT error:", e);
    return NextResponse.json({ error: "Chyba při úpravě pole" }, { status: 500 });
  }
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
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  try {
    await prisma.iml_custom_fields.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("IML custom fields DELETE error:", e);
    return NextResponse.json({ error: "Chyba při mazání pole" }, { status: 500 });
  }
}
