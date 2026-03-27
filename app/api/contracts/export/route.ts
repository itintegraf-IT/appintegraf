import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  parseContractListSearchParams,
  buildContractsWhere,
} from "@/lib/contracts/list-where";
import { contractStatusLabel } from "@/lib/contracts/status-labels";

function csvCell(s: string | number | null | undefined): string {
  const t = s == null ? "" : String(s);
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

/**
 * GET /api/contracts/export – CSV (UTF-8 s BOM pro Excel), stejné filtry jako seznam.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const filters = parseContractListSearchParams(searchParams);
  const where = buildContractsWhere(filters);

  const rows = await prisma.contracts.findMany({
    where,
    orderBy: { updated_at: "desc" },
    take: 5000,
    include: {
      contract_types: { select: { name: true } },
      users_created_by: { select: { first_name: true, last_name: true } },
    },
  });

  const header = [
    "id",
    "název",
    "číslo",
    "typ",
    "stav",
    "autor",
    "platnost_do",
    "expirace",
    "hodnota",
    "měna",
    "upraveno",
  ];

  const lines = [
    header.map((h) => csvCell(h)).join(";"),
    ...rows.map((c) =>
      [
        c.id,
        c.title,
        c.contract_number ?? "",
        c.contract_types?.name ?? "",
        contractStatusLabel(c.approval_status),
        c.users_created_by
          ? `${c.users_created_by.first_name} ${c.users_created_by.last_name}`
          : "",
        c.valid_until
          ? c.valid_until.toISOString().slice(0, 10)
          : "",
        c.expires_at ? c.expires_at.toISOString().slice(0, 10) : "",
        c.value_amount != null ? c.value_amount.toString() : "",
        c.value_currency ?? "",
        c.updated_at.toISOString().slice(0, 19).replace("T", " "),
      ]
        .map(csvCell)
        .join(";")
    ),
  ];

  const bom = "\ufeff";
  const body = bom + lines.join("\r\n");

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="smlouvy-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
