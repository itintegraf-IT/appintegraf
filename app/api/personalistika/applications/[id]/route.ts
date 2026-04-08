import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import {
  ensurePersonalistikaTables,
  normalizeCandidateStatus,
  type CandidateApplicationRow,
} from "@/lib/personalistika-db";
import { logPersonalistikaAudit } from "@/lib/personalistika-audit";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "personalistika", "read"))) {
    return NextResponse.json({ error: "Nemáte přístup." }, { status: 403 });
  }

  await ensurePersonalistikaTables();
  const id = parseInt((await params).id, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Neplatné ID." }, { status: 400 });

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT
      a.id, a.first_name, a.last_name, a.email, a.phone, a.position_id, a.position_name, a.notes,
      a.status, a.source, a.valid_from, a.valid_to, a.submitted_by_user_id, a.ip_address, a.user_agent,
      a.created_at, a.updated_at,
      a.details_json, a.consent_given, a.consent_date,
      a.attachment_path, a.attachment_original_name, a.attachment_mime, a.attachment_size
     FROM hr_candidate_applications a
     WHERE a.id = ?
     LIMIT 1`,
    id
  )) as Array<
    CandidateApplicationRow & {
      details_json: string | null;
      consent_given: number | null;
      consent_date: Date | null;
      attachment_path: string | null;
      attachment_original_name: string | null;
      attachment_mime: string | null;
      attachment_size: number | null;
    }
  >;

  if (!rows[0]) return NextResponse.json({ error: "Dotazník nebyl nalezen." }, { status: 404 });
  let details: Record<string, unknown> | null = null;
  if (rows[0].details_json) {
    try {
      details = JSON.parse(rows[0].details_json);
    } catch {
      details = null;
    }
  }
  return NextResponse.json({
    application: {
      ...rows[0],
      details,
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "personalistika", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění." }, { status: 403 });
  }

  await ensurePersonalistikaTables();
  const id = parseInt((await params).id, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Neplatné ID." }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const firstName = String(body.first_name ?? "").trim();
  const lastName = String(body.last_name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const notes = String(body.notes ?? "").trim();
  const status = normalizeCandidateStatus(String(body.status ?? "new"));
  const positionId = body.position_id ? parseInt(String(body.position_id), 10) : null;
  const validFrom = body.valid_from ? new Date(String(body.valid_from)) : null;
  const validTo = body.valid_to ? new Date(String(body.valid_to)) : null;

  if (!firstName || !lastName || !email) {
    return NextResponse.json({ error: "Jméno, příjmení a e-mail jsou povinné." }, { status: 400 });
  }

  let positionName: string | null = null;
  if (positionId && Number.isFinite(positionId)) {
    const positionRows = (await prisma.$queryRawUnsafe(
      `SELECT name FROM hr_positions WHERE id = ? LIMIT 1`,
      positionId
    )) as { name: string }[];
    positionName = positionRows[0]?.name ?? null;
  }

  const prevRows = (await prisma.$queryRawUnsafe(
    `SELECT first_name, last_name, email, phone, notes, status, position_id, position_name, valid_from, valid_to
     FROM hr_candidate_applications WHERE id = ? LIMIT 1`,
    id
  )) as Array<Record<string, unknown>>;
  const prev = prevRows[0];
  if (!prev) return NextResponse.json({ error: "Dotazník nebyl nalezen." }, { status: 404 });

  await prisma.$executeRawUnsafe(
    `UPDATE hr_candidate_applications
     SET first_name = ?, last_name = ?, email = ?, phone = ?, notes = ?, status = ?, position_id = ?, position_name = ?, valid_from = ?, valid_to = ?
     WHERE id = ?`,
    firstName,
    lastName,
    email,
    phone || null,
    notes || null,
    status,
    positionId && Number.isFinite(positionId) ? positionId : null,
    positionName,
    validFrom,
    validTo,
    id
  );

  await logPersonalistikaAudit({
    userId,
    action: "update:application",
    tableName: "hr_candidate_applications",
    recordId: id,
    oldValues: prev,
    newValues: {
      first_name: firstName,
      last_name: lastName,
      email,
      phone: phone || null,
      notes: notes || null,
      status,
      position_id: positionId && Number.isFinite(positionId) ? positionId : null,
      position_name: positionName,
      valid_from: validFrom,
      valid_to: validTo,
    },
  });

  return NextResponse.json({ success: true });
}
