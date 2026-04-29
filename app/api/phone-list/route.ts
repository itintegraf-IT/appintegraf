import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { attachMembersToDepartments } from "@/lib/phone-list-members";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tab = searchParams.get("tab") ?? "contacts";
  const search = searchParams.get("search")?.trim() ?? "";

  if (tab === "departments") {
    const deptAnd: Record<string, unknown>[] = [
      { OR: [{ is_active: true }, { is_active: null }] },
      { OR: [{ display_in_list: true }, { display_in_list: null }] },
    ];
    if (search) {
      deptAnd.push({
        OR: [
          { name: { contains: search } },
          { phone: { contains: search } },
          { landline: { contains: search } },
          { email: { contains: search } },
        ],
      });
    }

    const departments = await prisma.departments.findMany({
      where: { AND: deptAnd },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        phone: true,
        landline: true,
        landline2: true,
        email: true,
        notes: true,
      },
    });

    const departmentsWithMembers = await attachMembersToDepartments(departments);

    return NextResponse.json({ tab: "departments", departments: departmentsWithMembers });
  }

  const contactAnd: Record<string, unknown>[] = [
    { OR: [{ is_active: true }, { is_active: null }] },
    { OR: [{ display_in_list: true }, { display_in_list: null }] },
  ];
  if (search) {
    contactAnd.push({
      OR: [
        { first_name: { contains: search } },
        { last_name: { contains: search } },
        { phone: { contains: search } },
        { landline: { contains: search } },
        { email: { contains: search } },
      ],
    });
  }

  const contacts = await prisma.users.findMany({
    where: { AND: contactAnd },
    orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
    select: {
      id: true,
      first_name: true,
      last_name: true,
      phone: true,
      landline: true,
      landline2: true,
      email: true,
      position: true,
      department_name: true,
      qr_code: true,
    },
  });

  const contactsByDepartment: Record<string, typeof contacts> = {};
  for (const c of contacts) {
    const dept = c.department_name || "Bez oddělení";
    if (!contactsByDepartment[dept]) contactsByDepartment[dept] = [];
    contactsByDepartment[dept].push(c);
  }

  return NextResponse.json({
    tab: "contacts",
    contacts,
    contactsByDepartment: Object.entries(contactsByDepartment).sort(([a], [b]) =>
      a.localeCompare(b)
    ),
  });
}
