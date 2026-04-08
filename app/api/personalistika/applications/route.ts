import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import {
  ensurePersonalistikaTables,
  normalizeCandidateStatus,
  type CandidateApplicationRow,
} from "@/lib/personalistika-db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "personalistika", "read"))) {
    return NextResponse.json({ error: "Nemáte přístup k modulu Personalistika." }, { status: 403 });
  }

  await ensurePersonalistikaTables();

  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get("q") ?? "").trim();
  const status = normalizeCandidateStatus(searchParams.get("status"));

  const whereParts: string[] = [];
  const params: unknown[] = [];
  if (q) {
    whereParts.push(`(a.first_name LIKE ? OR a.last_name LIKE ? OR a.email LIKE ? OR a.phone LIKE ? OR a.position_name LIKE ?)`);
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }
  if (status !== "new" || searchParams.get("status")) {
    whereParts.push(`a.status = ?`);
    params.push(status);
  }
  const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT
      a.id, a.first_name, a.last_name, a.email, a.phone, a.position_id, a.position_name, a.notes,
      a.status, a.source, a.valid_from, a.valid_to, a.submitted_by_user_id, a.ip_address, a.user_agent,
      a.created_at, a.updated_at
     FROM hr_candidate_applications a
     ${whereSql}
     ORDER BY a.created_at DESC
     LIMIT 300`,
    ...params
  )) as CandidateApplicationRow[];

  return NextResponse.json({ applications: rows });
}
