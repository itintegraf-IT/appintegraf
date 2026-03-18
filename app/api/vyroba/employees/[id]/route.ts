import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "vyroba", "write"))) {
    return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const data: { name?: string; sort_order?: number; is_active?: boolean } =
      {};

    if (typeof body.name === "string") {
      const trimmed = body.name.trim();
      if (!trimmed) {
        return NextResponse.json(
          { error: "Jméno nemůže být prázdné" },
          { status: 400 }
        );
      }
      data.name = trimmed;
    }
    if (typeof body.sort_order === "number") {
      data.sort_order = body.sort_order;
    } else if (body.sort_order != null) {
      data.sort_order = parseInt(String(body.sort_order), 10) || 0;
    }
    if (typeof body.is_active === "boolean") {
      data.is_active = body.is_active;
    }

    const employee = await prisma.vyroba_employees.update({
      where: { id },
      data,
    });
    return NextResponse.json(employee);
  } catch (error) {
    console.error("[PATCH /api/vyroba/employees/[id]]", error);
    return NextResponse.json(
      { error: "Chyba při úpravě zaměstnance" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "vyroba", "write"))) {
    return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  try {
    await prisma.vyroba_employees.update({
      where: { id },
      data: { is_active: false },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/vyroba/employees/[id]]", error);
    return NextResponse.json(
      { error: "Chyba při mazání zaměstnance" },
      { status: 500 }
    );
  }
}
