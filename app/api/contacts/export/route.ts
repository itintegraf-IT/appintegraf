import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";

function escapeCsv(val: string | null | undefined): string {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "contacts", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const contacts = await prisma.users.findMany({
    where: {
      AND: [
        { OR: [{ is_active: true }, { is_active: null }] },
        { OR: [{ display_in_list: true }, { display_in_list: null }] },
      ],
    },
    orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
    select: {
      username: true,
      email: true,
      first_name: true,
      last_name: true,
      phone: true,
      landline: true,
      landline2: true,
      position: true,
      department_name: true,
    },
  });

  const header = "username;email;first_name;last_name;phone;landline;landline2;position;department_name";
  const rows = contacts.map(
    (c) =>
      [
        escapeCsv(c.username),
        escapeCsv(c.email),
        escapeCsv(c.first_name),
        escapeCsv(c.last_name),
        escapeCsv(c.phone),
        escapeCsv(c.landline),
        escapeCsv(c.landline2),
        escapeCsv(c.position),
        escapeCsv(c.department_name),
      ].join(";")
  );
  const csv = [header, ...rows].join("\n");
  const bom = "\uFEFF";

  return new NextResponse(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="kontakty.csv"',
    },
  });
}
