import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { getUserDepartmentIds } from "@/lib/ukoly-recipients";
import { ukolStatusLabel } from "@/lib/ukoly-status";
import { buildCsvResponse, escapeCsv } from "@/lib/iml-export";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "ukoly", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění k modulu Úkoly" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") || "csv";
  const selectedStatus =
    searchParams.get("status") === "done" || searchParams.get("status") === "cancelled"
      ? searchParams.get("status")
      : "";
  const selectedTerm =
    searchParams.get("term") === "month" || searchParams.get("term") === "quarter"
      ? searchParams.get("term")
      : "";

  const deptIds = await getUserDepartmentIds(userId);
  const or: Record<string, unknown>[] = [{ created_by: userId }, { assignee_user_id: userId }];
  if (deptIds.length > 0) {
    or.push({ ukoly_departments: { some: { department_id: { in: deptIds } } } });
  }

  const now = new Date();
  const where: Record<string, unknown> = {
    OR: or,
    status: selectedStatus || { in: ["done", "cancelled"] },
  };
  if (selectedTerm === "month") {
    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    where.updated_at = { gte: monthAgo };
  } else if (selectedTerm === "quarter") {
    const qAgo = new Date(now);
    qAgo.setMonth(qAgo.getMonth() - 3);
    where.updated_at = { gte: qAgo };
  }

  const rowsDb = await prisma.ukoly.findMany({
    where,
    orderBy: { updated_at: "desc" },
    include: {
      users_assignee: { select: { first_name: true, last_name: true } },
      users_creator: { select: { first_name: true, last_name: true } },
      ukoly_departments: { include: { departments: { select: { name: true } } } },
    },
  });

  const rows = rowsDb.map((r) => ({
    id: r.id,
    status: ukolStatusLabel(r.status),
    body: r.body.replace(/\s+/g, " ").trim(),
    order_number: r.order_number ?? "",
    assignee: r.users_assignee ? `${r.users_assignee.first_name} ${r.users_assignee.last_name}` : "",
    creator: `${r.users_creator.first_name} ${r.users_creator.last_name}`,
    departments: r.ukoly_departments.map((x) => x.departments.name).join(", "),
    assigned_at: new Date(r.assigned_at).toISOString(),
    due_at: new Date(r.due_at).toISOString(),
    updated_at: new Date(r.updated_at).toISOString(),
    urgent: r.urgent ? "ano" : "ne",
  }));

  if (format === "xlsx") {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Archiv úkolů");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="ukoly-archiv.xlsx"',
      },
    });
  }

  const header =
    "id;status;body;order_number;assignee;creator;departments;assigned_at;due_at;updated_at;urgent";
  const csvRows = rows.map((r) =>
    [
      r.id,
      escapeCsv(r.status),
      escapeCsv(r.body),
      escapeCsv(r.order_number),
      escapeCsv(r.assignee),
      escapeCsv(r.creator),
      escapeCsv(r.departments),
      escapeCsv(r.assigned_at),
      escapeCsv(r.due_at),
      escapeCsv(r.updated_at),
      escapeCsv(r.urgent),
    ].join(";")
  );
  return buildCsvResponse([header, ...csvRows].join("\n"), "ukoly-archiv.csv");
}
