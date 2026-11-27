import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageItVendorRequests } from "@/lib/it-vendor-request/access";
import { createItVendorRequest } from "@/lib/it-vendor-request/persist";
import { IT_VENDOR_STATUSES, IT_VENDOR_STATUS_LABELS } from "@/lib/it-vendor-request/lookups";
import { vendorFormSchema } from "@/lib/it-vendor-request/validation";
import type { it_vendor_request_status, Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canManageItVendorRequests(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status") ?? "all";
  const q = (searchParams.get("q") ?? "").trim();
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50));

  const SORT_FIELDS = [
    "created_at",
    "due_date",
    "status",
    "project_name",
    "vendor_company",
    "request_number",
  ] as const;
  type SortField = (typeof SORT_FIELDS)[number];
  const sortRaw = searchParams.get("sort") ?? "created_at";
  const sort: SortField = (SORT_FIELDS as readonly string[]).includes(sortRaw)
    ? (sortRaw as SortField)
    : "created_at";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";

  const where: Prisma.it_vendor_requestsWhereInput = {};

  if (statusFilter === "open") {
    where.status = { notIn: ["approved", "rejected", "cancelled"] };
  } else if (statusFilter !== "all" && (IT_VENDOR_STATUSES as readonly string[]).includes(statusFilter)) {
    where.status = statusFilter as it_vendor_request_status;
  }

  if (q) {
    where.OR = [
      { request_number: { contains: q } },
      { project_name: { contains: q } },
      { vendor_company: { contains: q } },
      { contact_name: { contains: q } },
      { contact_email: { contains: q } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.it_vendor_requests.count({ where }),
    prisma.it_vendor_requests.findMany({
      where,
      orderBy: { [sort]: order },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        request_number: true,
        status: true,
        project_name: true,
        vendor_company: true,
        contact_name: true,
        contact_email: true,
        due_date: true,
        submitted_at: true,
        created_at: true,
        updated_at: true,
      },
    }),
  ]);

  return NextResponse.json({
    items: rows.map((r) => ({
      ...r,
      status_label: IT_VENDOR_STATUS_LABELS[r.status],
      due_date: r.due_date ? r.due_date.toISOString().slice(0, 10) : null,
      submitted_at: r.submitted_at?.toISOString() ?? null,
      created_at: r.created_at.toISOString(),
      updated_at: r.updated_at.toISOString(),
    })),
    total,
    page,
    limit,
    sort,
    order,
    status_labels: IT_VENDOR_STATUS_LABELS,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canManageItVendorRequests(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = Object.keys(body || {}).length
      ? vendorFormSchema.safeParse(body)
      : { success: true as const, data: undefined };
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Neplatná data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const id = await createItVendorRequest({
      createdBy: userId,
      data: parsed.data,
    });

    return NextResponse.json({ success: true, id });
  } catch (e) {
    console.error("it-vendor-requests POST:", e);
    return NextResponse.json({ error: "Chyba při vytváření" }, { status: 500 });
  }
}
