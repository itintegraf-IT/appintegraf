import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { ensurePersonalistikaTables, type CandidatePositionRow } from "@/lib/personalistika-db";
import { logPersonalistikaAudit } from "@/lib/personalistika-audit";

export async function GET() {
  await ensurePersonalistikaTables();
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT id, name, is_active, created_at, updated_at
     FROM hr_positions
     ORDER BY name ASC`
  )) as CandidatePositionRow[];

  return NextResponse.json({ positions: rows });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "personalistika", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění ke správě pozic." }, { status: 403 });
  }

  await ensurePersonalistikaTables();
  const body = await req.json().catch(() => ({}));
  const name = String((body as Record<string, unknown>).name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Název pozice je povinný." }, { status: 400 });

  try {
    await prisma.$executeRawUnsafe(`INSERT INTO hr_positions (name, is_active) VALUES (?, 1)`, name);
    const createdRows = (await prisma.$queryRawUnsafe(
      `SELECT id FROM hr_positions WHERE name = ? ORDER BY id DESC LIMIT 1`,
      name
    )) as { id: number }[];
    const recordId = createdRows[0]?.id ?? 0;
    if (recordId > 0) {
      await logPersonalistikaAudit({
        userId,
        action: "create:position",
        tableName: "hr_positions",
        recordId,
        newValues: { name, is_active: 1 },
      });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Pozici se nepodařilo uložit (možná už existuje)." }, { status: 400 });
  }
}
