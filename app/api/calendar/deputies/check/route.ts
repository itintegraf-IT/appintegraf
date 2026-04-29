import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

const OUT_OF_OFFICE_TYPES = [
  "dovolena",
  "osobni",
  "schuzka_mimo_firmu",
  "schuzka_praha",
  "sluzebni_cesta",
  "lekar",
  "nemoc",
];

function formatDateTimeCs(d: Date): string {
  return d.toLocaleString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * GET /api/calendar/deputies/check?deputy_id=...&start_date=...&end_date=...&exclude_event_id=...
 * Rychlá kontrola, zda zvolený zástup nemá kolizi "mimo firmu".
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const deputyId = parseInt(searchParams.get("deputy_id") ?? "", 10);
  const startRaw = searchParams.get("start_date");
  const endRaw = searchParams.get("end_date");
  const excludeEventIdRaw = searchParams.get("exclude_event_id");
  const excludeEventId = excludeEventIdRaw ? parseInt(excludeEventIdRaw, 10) : null;

  if (isNaN(deputyId) || !startRaw || !endRaw) {
    return NextResponse.json(
      { error: "Chybí deputy_id, start_date nebo end_date" },
      { status: 400 }
    );
  }

  const start = new Date(startRaw);
  const end = new Date(endRaw);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    return NextResponse.json({ error: "Neplatný termín" }, { status: 400 });
  }

  const overlap = await prisma.calendar_events.findFirst({
    where: {
      ...(excludeEventId && !isNaN(excludeEventId) ? { id: { not: excludeEventId } } : {}),
      created_by: deputyId,
      event_type: { in: OUT_OF_OFFICE_TYPES },
      start_date: { lte: end },
      end_date: { gte: start },
      OR: [{ approval_status: { not: "rejected" } }, { approval_status: null }],
    },
    orderBy: { start_date: "asc" },
    select: {
      id: true,
      title: true,
      start_date: true,
      end_date: true,
    },
  });

  if (!overlap) {
    return NextResponse.json({ ok: true, hasConflict: false });
  }

  return NextResponse.json({
    ok: true,
    hasConflict: true,
    warning: `Zvolený zástup má v tomto termínu kolidující událost mimo firmu: „${overlap.title}“ (${formatDateTimeCs(
      overlap.start_date
    )}–${formatDateTimeCs(overlap.end_date)}).`,
    conflict: overlap,
  });
}
