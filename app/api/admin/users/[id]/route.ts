import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth-utils";
import bcrypt from "bcryptjs";

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
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const user = await prisma.users.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      email: true,
      first_name: true,
      last_name: true,
      phone: true,
      landline: true,
      landline2: true,
      position: true,
      department_name: true,
      department_id: true,
      is_active: true,
      display_in_list: true,
      role_id: true,
      created_at: true,
      roles: { select: { id: true, name: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Uživatel nenalezen" }, { status: 404 });
  }

  return NextResponse.json(user);
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
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const bodyData = body as Record<string, unknown>;
    const first_name = bodyData.first_name as string;
    const last_name = bodyData.last_name as string;
    const email = bodyData.email as string;
    const phone = (bodyData.phone as string) ?? "";
    const landline = (bodyData.landline as string) ?? "";
    const landline2 = (bodyData.landline2 as string) ?? "";
    const position = (bodyData.position as string) ?? "";
    const department_name = (bodyData.department_name as string) ?? "";
    const is_active = bodyData.is_active !== false;
    const display_in_list = bodyData.display_in_list !== false;
    const role_id = bodyData.role_id ?? null;
    const password_new = (bodyData.password_new as string) ?? "";

    if (!first_name || !last_name || !email) {
      return NextResponse.json({ error: "Vyplňte jméno, příjmení a e-mail" }, { status: 400 });
    }

    const emailExists = await prisma.users.findFirst({
      where: { email: email.trim(), id: { not: id } },
    });
    if (emailExists) {
      return NextResponse.json({ error: "E-mail již používá jiný uživatel" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      first_name: String(first_name).trim(),
      last_name: String(last_name).trim(),
      email: String(email).trim(),
      phone: phone.trim() || null,
      landline: landline.trim() || null,
      landline2: landline2.trim() || null,
      position: position.trim() || null,
      department_name: department_name.trim() || null,
      is_active: !!is_active,
      display_in_list: !!display_in_list,
      role_id: role_id != null ? parseInt(String(role_id), 10) : null,
    };

    if (password_new && password_new.length >= 6) {
      updateData.password_hash = await bcrypt.hash(password_new, 10);
      updateData.password_custom = null;
    }

    await prisma.users.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Admin user PUT error:", e);
    return NextResponse.json({ error: "Chyba při ukládání" }, { status: 500 });
  }
}
