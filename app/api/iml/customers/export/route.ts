import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { escapeCsv, buildCsvResponse } from "@/lib/iml-export";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění k modulu IML" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") || "csv";
  const search = searchParams.get("search")?.trim() ?? "";

  const where = search
    ? {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
          { contact_person: { contains: search } },
        ],
      }
    : {};

  const customers = await prisma.iml_customers.findMany({
    where,
    orderBy: { name: "asc" },
  });

  type CustomerRow = (typeof customers)[number];
  const rows = customers.map((c: CustomerRow) => ({
    id: c.id,
    name: c.name ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    contact_person: c.contact_person ?? "",
    allow_under_over_delivery_percent: c.allow_under_over_delivery_percent?.toString() ?? "",
    city: c.city ?? "",
    postal_code: c.postal_code ?? "",
    country: c.country ?? "",
    billing_address: c.billing_address ?? "",
    shipping_address: c.shipping_address ?? "",
    individual_requirements: c.individual_requirements ?? "",
    customer_note: c.customer_note ?? "",
    created_at: c.created_at ? new Date(c.created_at).toISOString().slice(0, 10) : "",
    updated_at: c.updated_at ? new Date(c.updated_at).toISOString().slice(0, 10) : "",
  }));

  if (format === "xlsx") {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Zákazníci");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="iml-zakaznici.xlsx"',
      },
    });
  }

  const header = "id;name;email;phone;contact_person;allow_under_over_delivery_percent;city;postal_code;country;billing_address;shipping_address;individual_requirements;customer_note;created_at;updated_at";
  type CsvRow = (typeof rows)[number];
  const csvRows = rows.map((r: CsvRow) =>
    [
      r.id,
      escapeCsv(r.name),
      escapeCsv(r.email),
      escapeCsv(r.phone),
      escapeCsv(r.contact_person),
      escapeCsv(r.allow_under_over_delivery_percent),
      escapeCsv(r.city),
      escapeCsv(r.postal_code),
      escapeCsv(r.country),
      escapeCsv(r.billing_address),
      escapeCsv(r.shipping_address),
      escapeCsv(r.individual_requirements),
      escapeCsv(r.customer_note),
      escapeCsv(r.created_at),
      escapeCsv(r.updated_at),
    ].join(";")
  );
  const csv = [header, ...csvRows].join("\n");
  return buildCsvResponse(csv, "iml-zakaznici.csv");
}
