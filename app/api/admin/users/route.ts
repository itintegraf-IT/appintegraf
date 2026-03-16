import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth-utils";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { first_name: { contains: search } },
      { last_name: { contains: search } },
      { email: { contains: search } },
      { username: { contains: search } },
    ];
  }

  const users = await prisma.users.findMany({
    where,
    orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
    take: 200,
    select: {
      id: true,
      username: true,
      email: true,
      first_name: true,
      last_name: true,
      phone: true,
      position: true,
      department_name: true,
      is_active: true,
      role_id: true,
      created_at: true,
      roles: { select: { name: true } },
    },
  });

  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      username,
      email,
      first_name,
      last_name,
      phone = "",
      landline = "",
      landline2 = "",
      position = "",
      department_name = "",
      role_id = 1,
      module_access = {},
      is_active = true,
      display_in_list = true,
      password_custom = "heslo123",
    } = body;

    if (!username || !email || !first_name || !last_name) {
      return NextResponse.json({ error: "Vyplňte povinná pole" }, { status: 400 });
    }

    const existing = await prisma.users.findFirst({
      where: { OR: [{ username }, { email }] },
    });
    if (existing) {
      return NextResponse.json(
        { error: existing.username === username ? "Uživatelské jméno již existuje" : "E-mail již existuje" },
        { status: 400 }
      );
    }

    const qrCode = String(Math.floor(Math.random() * 1e12)).padStart(12, "0");
    const passwordHash = await bcrypt.hash(password_custom || "heslo123", 10);
    const roleIdNum = role_id ? parseInt(String(role_id), 10) : 1;

    const user = await prisma.users.create({
      data: {
        username: username.trim(),
        email: email.trim(),
        password_hash: passwordHash,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        phone: phone.trim() || null,
        landline: landline.trim() || null,
        landline2: landline2.trim() || null,
        position: position.trim() || null,
        department_name: department_name.trim() || null,
        role_id: roleIdNum,
        display_in_list: !!display_in_list,
        is_active: !!is_active,
        qr_code: qrCode,
      },
    });

    const role = await prisma.roles.findUnique({ where: { id: roleIdNum }, select: { name: true } });
    const isAdminRole = role?.name?.toLowerCase() === "admin";
    const moduleAccessJson = isAdminRole
      ? JSON.stringify({ all: true })
      : JSON.stringify(module_access as Record<string, string>);

    try {
      await prisma.user_roles.create({
        data: { user_id: user.id, role_id: roleIdNum, module_access: moduleAccessJson },
      });
    } catch {
      // ignore
    }

    return NextResponse.json({ success: true, id: user.id, qr_code: qrCode });
  } catch (e) {
    console.error("Admin user POST error:", e);
    return NextResponse.json({ error: "Chyba při vytváření uživatele" }, { status: 500 });
  }
}
