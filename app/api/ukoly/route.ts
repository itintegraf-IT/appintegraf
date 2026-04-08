import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { getUserDepartmentIds } from "@/lib/ukoly-recipients";
import { notifyUkolRecipients } from "@/lib/ukoly-notify";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "image/jpeg",
  "image/png",
  "image/jpg",
]);
const MAX_BYTES = 15 * 1024 * 1024;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "ukoly", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const deptIds = await getUserDepartmentIds(userId);
  const or: Record<string, unknown>[] = [
    { created_by: userId },
    { assignee_user_id: userId },
  ];
  if (deptIds.length > 0) {
    or.push({
      ukoly_departments: { some: { department_id: { in: deptIds } } },
    });
  }

  const rows = await prisma.ukoly.findMany({
    where: {
      status: { notIn: ["done", "cancelled"] },
      OR: or,
    },
    orderBy: { due_at: "asc" },
    take: 200,
    include: {
      users_assignee: { select: { first_name: true, last_name: true } },
      users_creator: { select: { first_name: true, last_name: true } },
      ukoly_departments: { include: { departments: { select: { id: true, name: true } } } },
    },
  });

  return NextResponse.json({ ukoly: rows });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "ukoly", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění zadávat úkoly" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const body = String(formData.get("body") ?? "").trim();
    const order_number = String(formData.get("order_number") ?? "").trim() || null;
    const dueRaw = String(formData.get("due_at") ?? "").trim();
    const urgent =
      formData.get("urgent") === "true" ||
      formData.get("urgent") === "on" ||
      formData.get("urgent") === "1";

    const assigneeRaw = String(formData.get("assignee_user_id") ?? "").trim();
    const assignee_user_id = assigneeRaw ? parseInt(assigneeRaw, 10) : null;
    if (assigneeRaw && (assignee_user_id == null || Number.isNaN(assignee_user_id))) {
      return NextResponse.json({ error: "Neplatný přiřazený uživatel" }, { status: 400 });
    }

    const deptValues = formData.getAll("department_ids");
    const department_ids: number[] = [];
    for (const v of deptValues) {
      const n = parseInt(String(v), 10);
      if (!Number.isNaN(n)) department_ids.push(n);
    }
    const uniqueDeptIds = [...new Set(department_ids)];

    if (!body) {
      return NextResponse.json({ error: "Vyplňte zadání úkolu" }, { status: 400 });
    }
    if (!dueRaw) {
      return NextResponse.json({ error: "Vyplňte termín splnění" }, { status: 400 });
    }
    const due_at = new Date(dueRaw);
    if (Number.isNaN(due_at.getTime())) {
      return NextResponse.json({ error: "Neplatný termín" }, { status: 400 });
    }
    if (assignee_user_id == null && uniqueDeptIds.length === 0) {
      return NextResponse.json(
        { error: "Vyberte přiřazeného uživatele a/nebo alespoň jedno oddělení" },
        { status: 400 }
      );
    }

    if (assignee_user_id != null) {
      const u = await prisma.users.findFirst({
        where: { id: assignee_user_id, is_active: true },
        select: { id: true },
      });
      if (!u) {
        return NextResponse.json({ error: "Uživatel neexistuje nebo není aktivní" }, { status: 400 });
      }
    }

    if (uniqueDeptIds.length > 0) {
      const cnt = await prisma.departments.count({
        where: { id: { in: uniqueDeptIds }, is_active: true },
      });
      if (cnt !== uniqueDeptIds.length) {
        return NextResponse.json({ error: "Neplatné oddělení" }, { status: 400 });
      }
    }

    let attachment_path: string | null = null;
    let attachment_original_name: string | null = null;
    const file = formData.get("attachment");
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: "Soubor je příliš velký (max 15 MB)" }, { status: 400 });
      }
      const mime = file.type || "application/octet-stream";
      if (!ALLOWED_MIME.has(mime)) {
        return NextResponse.json(
          { error: "Nepovolený typ souboru (PDF, Word, Excel, JPG, PNG)" },
          { status: 400 }
        );
      }
      const ext = path.extname(file.name) || ".bin";
      const uploadDir = path.join(process.cwd(), "public", "uploads", "ukoly");
      await mkdir(uploadDir, { recursive: true });
      const newName = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
      const buf = Buffer.from(await file.arrayBuffer());
      await writeFile(path.join(uploadDir, newName), buf);
      attachment_path = `/uploads/ukoly/${newName}`;
      attachment_original_name = file.name;
    }

    const created = await prisma.ukoly.create({
      data: {
        body,
        order_number,
        due_at,
        urgent,
        assignee_user_id,
        created_by: userId,
        attachment_path,
        attachment_original_name,
        ukoly_departments: {
          create: uniqueDeptIds.map((department_id) => ({ department_id })),
        },
      },
      include: { ukoly_departments: true },
    });

    await notifyUkolRecipients({
      ukolId: created.id,
      bodyPreview: body,
      orderNumber: order_number,
      kind: "assigned",
      assigneeUserId: assignee_user_id,
      departmentIds: uniqueDeptIds,
    });

    return NextResponse.json({ success: true, id: created.id });
  } catch (e) {
    console.error("POST /api/ukoly", e);
    return NextResponse.json({ error: "Chyba při ukládání úkolu" }, { status: 500 });
  }
}
