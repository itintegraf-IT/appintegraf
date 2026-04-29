import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth-utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

  const row = await prisma.shared_mails.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const adminId = parseInt(session.user.id, 10);
  if (!(await isAdmin(adminId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

  try {
    const body = (await req.json()) as { email?: string; label?: string; sort_order?: number; is_active?: boolean };
    const data: {
      email?: string;
      label?: string;
      sort_order?: number;
      is_active?: boolean;
    } = {};
    if (body.label !== undefined) data.label = String(body.label).trim();
    if (body.email !== undefined) data.email = String(body.email).trim().toLowerCase();
    if (body.sort_order !== undefined) data.sort_order = Number(body.sort_order);
    if (body.is_active !== undefined) data.is_active = !!body.is_active;

    const row = await prisma.shared_mails.update({ where: { id }, data });
    return NextResponse.json(row);
  } catch (e) {
    console.error("PUT shared_mails", e);
    return NextResponse.json({ error: "E-mail může být duplicitní nebo uložení selhalo" }, { status: 400 });
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
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

  try {
    await prisma.shared_mails.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Smazání se nezdařilo" }, { status: 400 });
  }
}
