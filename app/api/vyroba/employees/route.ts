import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "vyroba", "read"))) {
    return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
  }

  try {
    const activeOnly = new URL(request.url).searchParams.get("active") === "true";
    const employees = await prisma.vyroba_employees.findMany({
      where: activeOnly ? { is_active: true } : undefined,
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(employees);
  } catch (error) {
    console.error("[GET /api/vyroba/employees]", error);
    return NextResponse.json(
      { error: "Chyba při načítání zaměstnanců" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "vyroba", "write"))) {
    return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json(
        { error: "Jméno je povinné" },
        { status: 400 }
      );
    }

    const sortOrder =
      typeof body.sort_order === "number"
        ? body.sort_order
        : parseInt(String(body.sort_order ?? 0), 10) || 0;

    const maxOrder = await prisma.vyroba_employees.aggregate({
      _max: { sort_order: true },
    });
    const finalSortOrder =
      sortOrder > 0 ? sortOrder : (maxOrder._max.sort_order ?? 0) + 1;

    const employee = await prisma.vyroba_employees.create({
      data: {
        name,
        sort_order: finalSortOrder,
        is_active: true,
      },
    });
    return NextResponse.json(employee);
  } catch (error) {
    console.error("[POST /api/vyroba/employees]", error);
    return NextResponse.json(
      { error: "Chyba při přidávání zaměstnance" },
      { status: 500 }
    );
  }
}
