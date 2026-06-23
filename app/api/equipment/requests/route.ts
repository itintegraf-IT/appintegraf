import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { createEquipmentRequest } from "@/lib/equipment-request-create";

/** GET – seznam požadavků na techniku (pro uživatele s přístupem k modulu Majetek) */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "equipment", "read"))) {
    return NextResponse.json({ error: "Nemáte přístup k modulu Majetek" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status") ?? "all";

  const where: Record<string, unknown> = {};
  if (statusFilter !== "all") {
    where.status = statusFilter;
  }

  const requests = await prisma.equipment_requests.findMany({
    where,
    orderBy: { created_at: "desc" },
    take: 100,
    include: {
      users_it: { select: { id: true, first_name: true, last_name: true } },
      users_approval: { select: { id: true, first_name: true, last_name: true } },
    },
  });

  return NextResponse.json({ requests });
}

/** POST – vytvoření požadavku přihlášeným uživatelem (data žadatele ze serveru) */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);

  try {
    const body = await req.json();
    const { equipment_type, description, priority = "st_edn_" } = body;

    if (!equipment_type || !description) {
      return NextResponse.json(
        { error: "Vyplňte typ vybavení a popis" },
        { status: 400 }
      );
    }

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        phone: true,
        department_name: true,
        position: true,
        is_active: true,
      },
    });

    if (!user || !user.is_active) {
      return NextResponse.json({ error: "Uživatel nenalezen" }, { status: 404 });
    }

    const request = await createEquipmentRequest({
      requester_name: `${user.first_name} ${user.last_name}`.trim(),
      requester_email: user.email,
      requester_phone: user.phone,
      department: user.department_name,
      position: user.position,
      equipment_type: String(equipment_type),
      description: String(description),
      priority,
      requester_user_id: user.id,
    });

    return NextResponse.json({
      success: true,
      id: request.id,
      message: `Požadavek úspěšně odeslán! Číslo požadavku: #${request.id}`,
    });
  } catch (e) {
    console.error("Equipment request auth POST error:", e);
    return NextResponse.json(
      { error: "Chyba systému, zkuste to později" },
      { status: 500 }
    );
  }
}
