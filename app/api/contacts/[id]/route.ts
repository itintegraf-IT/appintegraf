import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import bcrypt from "bcryptjs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  // Read: povoleno všem přihlášeným

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const contact = await prisma.users.findFirst({
    where: { id, is_active: true },
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
      qr_code: true,
      notes: true,
      display_in_list: true,
      role_id: true,
      roles: { select: { name: true } },
    },
  });

  if (!contact) {
    return NextResponse.json({ error: "Kontakt nenalezen" }, { status: 404 });
  }

  return NextResponse.json(contact);
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
  if (!(await hasModuleAccess(userId, "contacts", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const {
      username,
      email,
      first_name,
      last_name,
      phone,
      landline,
      landline2,
      position,
      department_name,
      role_id,
      display_in_list,
      password_custom,
    } = body;

    if (!username || !email || !first_name || !last_name) {
      return NextResponse.json({ error: "Vyplňte povinná pole" }, { status: 400 });
    }

    const existing = await prisma.users.findFirst({
      where: {
        OR: [{ username: username.trim() }, { email: email.trim() }],
        NOT: { id },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: existing.username === username ? "Uživatelské jméno již existuje" : "E-mail již existuje" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      username: username.trim(),
      email: email.trim(),
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      phone: (phone ?? "").trim() || null,
      landline: (landline ?? "").trim() || null,
      landline2: (landline2 ?? "").trim() || null,
      position: (position ?? "").trim() || null,
      department_name: (department_name ?? "").trim() || null,
      role_id: role_id ?? null,
      display_in_list: display_in_list !== false,
    };

    if (password_custom && password_custom.length >= 4) {
      updateData.password_hash = await bcrypt.hash(password_custom, 10);
      updateData.password_custom = null;
    }

    await prisma.users.update({
      where: { id },
      data: updateData as never,
    });

    if (role_id) {
      const existing = await prisma.user_roles.findFirst({
        where: { user_id: id, role_id },
      });
      if (!existing) {
        await prisma.user_roles.create({
          data: { user_id: id, role_id },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Contacts PUT error:", e);
    return NextResponse.json({ error: "Chyba při úpravě kontaktu" }, { status: 500 });
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
  if (!(await hasModuleAccess(userId, "contacts", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  await prisma.users.update({
    where: { id },
    data: { is_active: false },
  });

  return NextResponse.json({ success: true });
}
