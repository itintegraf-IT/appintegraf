import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth-utils";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const departments = await prisma.departments.findMany({
    orderBy: { name: "asc" },
    include: {
      users: { select: { id: true, first_name: true, last_name: true } },
    },
  });

  return NextResponse.json({ departments });
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
      name,
      code = "",
      description = "",
      manager_id = null,
      phone = "",
      email = "",
      landline = "",
      landline2 = "",
      notes = "",
      is_active = true,
      display_in_list = true,
    } = body;

    if (!name) {
      return NextResponse.json({ error: "Vyplňte název oddělení" }, { status: 400 });
    }

    const dept = await prisma.departments.create({
      data: {
        name: String(name).trim(),
        code: code.trim() || null,
        description: description.trim() || null,
        manager_id: manager_id ? parseInt(manager_id, 10) : null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        landline: landline.trim() || null,
        landline2: landline2.trim() || null,
        notes: notes.trim() || null,
        is_active: !!is_active,
        display_in_list: !!display_in_list,
      },
    });

    return NextResponse.json({ success: true, id: dept.id });
  } catch (e) {
    console.error("Department POST error:", e);
    return NextResponse.json({ error: "Chyba při vytváření oddělení" }, { status: 500 });
  }
}
