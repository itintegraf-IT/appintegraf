import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import {
  replaceUserSecondaryDepartments,
  resolveContactDepartmentIds,
} from "@/lib/contacts-user-departments";

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
      personal_phone: true,
      personal_email: true,
      position: true,
      department_name: true,
      department_id: true,
      user_secondary_departments: {
        select: { department_id: true },
        orderBy: { id: "asc" },
      },
      qr_code: true,
      notes: true,
      display_in_list: true,
    },
  });

  if (!contact) {
    return NextResponse.json({ error: "Kontakt nenalezen" }, { status: 404 });
  }

  const { user_secondary_departments: usd, ...rest } = contact;
  return NextResponse.json({
    ...rest,
    secondary_department_ids: usd.map((r) => r.department_id).slice(0, 2),
  });
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
      personal_phone,
      personal_email,
      position,
      department_name,
      department_id,
      secondary_department_ids,
      display_in_list,
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

    const { department_id: primId, secondaryIds } = await resolveContactDepartmentIds(
      department_id,
      secondary_department_ids
    );

    await prisma.$transaction(async (tx) => {
      await tx.users.update({
        where: { id },
        data: {
          username: username.trim(),
          email: email.trim(),
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          phone: (phone ?? "").trim() || null,
          landline: (landline ?? "").trim() || null,
          landline2: (landline2 ?? "").trim() || null,
          personal_phone: (personal_phone ?? "").trim() || null,
          personal_email: (personal_email ?? "").trim() || null,
          position: (position ?? "").trim() || null,
          department_name: (department_name ?? "").trim() || null,
          department_id: primId,
          display_in_list: display_in_list !== false,
        },
      });
      await replaceUserSecondaryDepartments(tx, id, primId, secondaryIds);
    });

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
