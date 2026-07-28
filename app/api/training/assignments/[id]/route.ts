import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";

async function requireWrite(): Promise<{ userId: number } | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "training", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění spravovat přiřazení" }, { status: 403 });
  }
  return { userId };
}

function parseDate(value: unknown): Date | null {
  if (!value || typeof value !== "string") return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireWrite();
  if (access instanceof NextResponse) return access;

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

  try {
    const body = await req.json();
    const existing = await prisma.test_assignments.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Přiřazení nenalezeno" }, { status: 404 });

    const data: Record<string, unknown> = {};

    if (body.start_date !== undefined) data.start_date = parseDate(body.start_date);
    if (body.end_date !== undefined) data.end_date = parseDate(body.end_date);
    if (body.max_attempts !== undefined) {
      const parsed = parseInt(String(body.max_attempts), 10);
      data.max_attempts = isNaN(parsed) ? null : Math.min(100, Math.max(1, parsed));
    }
    if (body.is_active !== undefined) data.is_active = !!body.is_active;

    const start = (data.start_date ?? existing.start_date) as Date | null;
    const end = (data.end_date ?? existing.end_date) as Date | null;
    if (start && end && end < start) {
      return NextResponse.json({ error: "Datum konce nesmí být před začátkem" }, { status: 400 });
    }

    await prisma.test_assignments.update({ where: { id }, data });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Training assignment PUT error:", e);
    return NextResponse.json({ error: "Chyba při ukládání přiřazení" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireWrite();
  if (access instanceof NextResponse) return access;

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });

  try {
    const attempts = await prisma.test_attempts.count({ where: { assignment_id: id } });

    if (attempts > 0) {
      // Existují pokusy navázané na přiřazení – jen deaktivace kvůli historii
      await prisma.test_assignments.update({ where: { id }, data: { is_active: false } });
      return NextResponse.json({ success: true, deactivated: true });
    }

    await prisma.test_assignments.delete({ where: { id } });
    return NextResponse.json({ success: true, deleted: true });
  } catch (e) {
    console.error("Training assignment DELETE error:", e);
    return NextResponse.json({ error: "Chyba při mazání přiřazení" }, { status: 500 });
  }
}
