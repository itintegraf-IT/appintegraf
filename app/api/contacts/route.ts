import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  // Read: povoleno všem přihlášeným (jako v PHP)
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const department = searchParams.get("department")?.trim() ?? "";
  const sort = searchParams.get("sort") ?? "last_name";
  const dir = searchParams.get("dir") ?? "asc";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const perPageParam = searchParams.get("per_page") ?? "20";

  const perPage = perPageParam === "all" ? null : Math.min(100, Math.max(1, parseInt(perPageParam, 10) || 20));
  const skip = perPage ? (page - 1) * perPage : 0;

  const andConditions: Record<string, unknown>[] = [
    { OR: [{ is_active: true }, { is_active: null }] },
    { OR: [{ display_in_list: true }, { display_in_list: null }] },
  ];
  if (search) {
    andConditions.push({
      OR: [
        { first_name: { contains: search } },
        { last_name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
        { landline: { contains: search } },
        { landline2: { contains: search } },
        { qr_code: { contains: search } },
      ],
    });
  }
  if (department) {
    andConditions.push({ department_name: { contains: department } });
  }
  const where = { AND: andConditions };

  const orderBy: { first_name?: "asc" | "desc"; last_name?: "asc" | "desc" }[] =
    sort === "first_name"
      ? [{ first_name: dir === "desc" ? "desc" : "asc" }, { last_name: "asc" }]
      : [{ last_name: dir === "desc" ? "desc" : "asc" }, { first_name: "asc" }];

  const [contacts, total] = await Promise.all([
    prisma.users.findMany({
      where,
      orderBy,
      skip: perPage ? skip : 0,
      take: perPage ?? undefined,
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        phone: true,
        landline: true,
        landline2: true,
        position: true,
        department_name: true,
        qr_code: true,
        role_id: true,
        roles: { select: { name: true } },
      },
    }),
    prisma.users.count({ where }),
  ]);

  const totalPages = perPage ? Math.max(1, Math.ceil(total / perPage)) : 1;

  return NextResponse.json({
    contacts,
    total,
    page,
    perPage: perPage ?? total,
    totalPages,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "contacts", "write"))) {
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
        role_id: role_id || null,
        display_in_list: !!display_in_list,
        qr_code: qrCode,
        is_active: true,
      },
    });

    try {
      await prisma.user_roles.create({
        data: { user_id: user.id, role_id: role_id || 1 },
      });
    } catch {
      // již existuje
    }

    return NextResponse.json({ success: true, id: user.id, qr_code: qrCode });
  } catch (e) {
    console.error("Contacts POST error:", e);
    return NextResponse.json({ error: "Chyba při vytváření kontaktu" }, { status: 500 });
  }
}
