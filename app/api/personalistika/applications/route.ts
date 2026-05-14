import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUsersWithModuleAdmin, hasModuleAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import {
  insertCandidateApplication,
  parseApplicationFormData,
} from "@/lib/personalistika-application";
import {
  buildApplicationsWhereClause,
  normalizeDatePreset,
} from "@/lib/personalistika-filters";
import {
  ensurePersonalistikaTables,
  normalizeCandidateStatus,
  parseDetailsJson,
  type CandidateApplicationRow,
} from "@/lib/personalistika-db";
import { logPersonalistikaAudit } from "@/lib/personalistika-audit";

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "personalistika", "read"))) {
    return NextResponse.json({ error: "Nemáte přístup k modulu Personalistika." }, { status: 403 });
  }

  await ensurePersonalistikaTables();

  const { searchParams } = new URL(req.url);
  const positionIdRaw = String(searchParams.get("position_id") ?? "").trim();
  const parsedPositionId = positionIdRaw ? parseInt(positionIdRaw, 10) : null;

  const { whereSql, params } = buildApplicationsWhereClause({
    q: searchParams.get("q") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    positionId: Number.isFinite(parsedPositionId) ? parsedPositionId : null,
    workType: searchParams.get("work_type"),
    educationLevel: searchParams.get("education_level"),
    city: searchParams.get("city"),
    datePreset: normalizeDatePreset(searchParams.get("date_preset")),
    dateFrom: searchParams.get("date_from"),
  });

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT
      a.id, a.first_name, a.last_name, a.email, a.phone, a.position_id, a.position_name, a.notes,
      a.status, a.source, a.valid_from, a.valid_to, a.submitted_by_user_id, a.ip_address, a.user_agent,
      a.details_json, a.created_at, a.updated_at
     FROM hr_candidate_applications a
     ${whereSql}
     ORDER BY a.created_at DESC
     LIMIT 300`,
    ...params
  )) as (CandidateApplicationRow & { details_json: string | null })[];

  const applications = rows.map((row) => {
    const { details_json, ...rest } = row;
    return {
      ...rest,
      status: normalizeCandidateStatus(rest.status),
      details: parseDetailsJson(details_json),
    };
  });

  return NextResponse.json({ applications });
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    const userId = parseInt(session.user.id, 10);
    if (!(await hasModuleAccess(userId, "personalistika", "write"))) {
      return NextResponse.json({ error: "Nemáte oprávnění k zápisu." }, { status: 403 });
    }

    await ensurePersonalistikaTables();
    const formData = await req.formData();
    const parsed = await parseApplicationFormData(formData, { defaultSource: "internal" });
    if (!parsed.data) {
      return NextResponse.json({ error: parsed.error ?? "Neplatná data." }, { status: 400 });
    }

    const ip = getClientIp(req);
    const appId = await insertCandidateApplication(parsed.data, {
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") ?? null,
      submittedByUserId: userId,
    });

    if (appId > 0) {
      await logPersonalistikaAudit({
        userId,
        action: "create:internal_application",
        tableName: "hr_candidate_applications",
        recordId: appId,
        newValues: {
          first_name: parsed.data.firstName,
          last_name: parsed.data.lastName,
          email: parsed.data.email,
          source: "internal",
          position_id: parsed.data.positionId,
        },
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") ?? null,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Dotazník byl úspěšně uložen.",
      id: appId,
    });
  } catch (error) {
    console.error("Personalistika applications POST error:", error);
    return NextResponse.json({ error: "Chyba systému, zkuste to později." }, { status: 500 });
  }
}
