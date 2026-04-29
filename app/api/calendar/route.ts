import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createCalendarEventUnit } from "@/lib/calendar-create-one";
import { expandRecurrence, type RecurrenceKind } from "@/lib/calendar-recurrence";
import {
  getEventTypeLabel,
  requiresBusinessTripDescription,
  requiresDeputy,
} from "@/app/(dashboard)/calendar/lib/event-types";
import { sendCalendarApprovalEmail } from "@/lib/email";
import { findCreatorCalendarOverlap, formatOverlapErrorCs } from "@/lib/calendar-time-overlap";
import {
  normalizeParticipantUserIds,
  replaceEventParticipants,
  notifyCalendarInvitees,
} from "@/lib/calendar-participant-sync";

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

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = {};

  if (from && to) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    where.start_date = { lte: toDate };
    where.end_date = { gte: fromDate };
  }

  const events = await prisma.calendar_events.findMany({
    where: { ...where, is_private: { not: true } },
    orderBy: { start_date: "asc" },
    take: 100,
    include: {
      users: { select: { first_name: true, last_name: true } },
    },
  });

  return NextResponse.json({ events });
}

const RECURRENCE_VALUES = new Set<string>(["none", "daily", "weekly", "monthly"]);
const REMINDER_MINUTES_ALLOW = new Set([15, 30, 60, 120, 1440]);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      title,
      description = "",
      start_date,
      end_date,
      event_type = "jine",
      department_id = null,
      deputy_id = null,
      is_private = false,
      location = "",
      recurrence: recurrenceRaw = "none",
      recurrence_end = null,
      remind_before_minutes: remindRaw = null,
      reminder_notify_in_app: naRaw = true,
      reminder_notify_email: neRaw = true,
      participant_user_ids: participantUserIdsRaw = null,
    } = body;

    if (!title || !start_date || !end_date) {
      return NextResponse.json({ error: "Vyplňte název, datum začátku a konce" }, { status: 400 });
    }

    const userId = parseInt(session.user.id, 10);
    const eventType = String(event_type).trim() || "jine";
    const recurrence: RecurrenceKind = RECURRENCE_VALUES.has(String(recurrenceRaw))
      ? (String(recurrenceRaw) as RecurrenceKind)
      : "none";

    if (recurrence !== "none" && requiresDeputy(eventType)) {
      return NextResponse.json(
        {
          error:
            "Opakování není u typů s povinným zástupným schvalováním k dispozici. Zadejte jednotlivé žádosti, nebo zvolte jiný typ události.",
        },
        { status: 400 }
      );
    }

    if (recurrence !== "none") {
      if (!recurrence_end || typeof recurrence_end !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(recurrence_end)) {
        return NextResponse.json(
          { error: "U opakování vyplňte „Opakovat do“ (datum posledního výskytu)." },
          { status: 400 }
        );
      }
    }

    let remindBefore: number | null = null;
    if (remindRaw !== null && remindRaw !== undefined && String(remindRaw).trim() !== "") {
      const n = parseInt(String(remindRaw), 10);
      if (Number.isFinite(n) && REMINDER_MINUTES_ALLOW.has(n)) {
        remindBefore = n;
      }
    }
    const reminderInApp = naRaw !== false;
    const reminderEmail = neRaw !== false;
    if (remindBefore !== null && !reminderInApp && !reminderEmail) {
      return NextResponse.json(
        { error: "U připomínky zvolte alespoň notifikace v aplikaci nebo e-mail." },
        { status: 400 }
      );
    }

    let deputyIdNum: number | null = null;

    if (requiresDeputy(eventType)) {
      if (!deputy_id) {
        return NextResponse.json(
          { error: "Pro zvolený typ události je zástup povinný (schvalování)." },
          { status: 400 }
        );
      }
      const parsed = parseInt(deputy_id, 10);
      if (isNaN(parsed)) {
        return NextResponse.json({ error: "Neplatný zástup" }, { status: 400 });
      }
      deputyIdNum = parsed;
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: {
          department_id: true,
          user_secondary_departments: { select: { department_id: true } },
        },
      });
      const deptIds: number[] = [];
      if (user?.department_id) deptIds.push(user.department_id);
      for (const s of user?.user_secondary_departments ?? []) {
        if (!deptIds.includes(s.department_id)) deptIds.push(s.department_id);
      }
      const deputy = await prisma.users.findFirst({
        where: {
          id: deputyIdNum,
          is_active: true,
          OR: [
            { department_id: { in: deptIds } },
            { user_secondary_departments: { some: { department_id: { in: deptIds } } } },
          ],
        },
      });
      if (!deputy) {
        return NextResponse.json({ error: "Uživatel nemůže být zástupem" }, { status: 400 });
      }
    }

    const start = new Date(start_date);
    const end = new Date(end_date);
    if (end <= start) {
      return NextResponse.json({ error: "Datum konce musí být po datu začátku" }, { status: 400 });
    }

    const until = new Date(
      recurrence !== "none" && recurrence_end ? String(recurrence_end).slice(0, 10) : start_date
    );
    const slots = expandRecurrence(start, end, recurrence, until);
    if (slots.length === 0) {
      return NextResponse.json(
        { error: "Neplatné období opakování (zkontrolujte datum „Opakovat do“)." },
        { status: 400 }
      );
    }

    for (const slot of slots) {
      const selfOverlap = await findCreatorCalendarOverlap(prisma, userId, slot.start, slot.end, {});
      if (selfOverlap) {
        return NextResponse.json(
          { error: formatOverlapErrorCs(selfOverlap, formatDateTimeCs) },
          { status: 409 }
        );
      }
      if (deputyIdNum !== null) {
        const depOverlap = await prisma.calendar_events.findFirst({
          where: {
            created_by: deputyIdNum,
            event_type: { in: OUT_OF_OFFICE_TYPES },
            start_date: { lte: slot.end },
            end_date: { gte: slot.start },
            OR: [{ approval_status: { not: "rejected" } }, { approval_status: null }],
          },
          orderBy: { start_date: "asc" },
          select: { title: true, start_date: true, end_date: true },
        });
        if (depOverlap) {
          return NextResponse.json(
            {
              error: `Zvolený zástup má kolidující událost mimo firmu (${depOverlap.title}, ${formatDateTimeCs(
                depOverlap.start_date
              )}–${formatDateTimeCs(depOverlap.end_date)}). Vyberte jiného zástupa nebo jiný termín.`,
            },
            { status: 409 }
          );
        }
      }
    }

    const creator = await prisma.users.findUnique({
      where: { id: userId },
      select: { first_name: true, last_name: true, department_id: true },
    });
    const creatorName = creator ? `${creator.first_name} ${creator.last_name}` : "Uživatel";

    const resolvedDeptId = department_id
      ? parseInt(department_id, 10)
      : creator?.department_id ?? null;

    const titleTrim = String(title).trim();
    const descTrim = description ? String(description).trim() : "";
    const locTrim = location ? String(location).trim() : "";

    if (requiresBusinessTripDescription(eventType) && !descTrim) {
      return NextResponse.json(
        {
          error:
            "U služební cesty vyplňte popis (kde a proč jedete) – je povinný pro schvalovatele.",
        },
        { status: 400 }
      );
    }

    const participantUserIds = normalizeParticipantUserIds(participantUserIdsRaw, {
      creatorId: userId,
      deputyId: deputyIdNum,
    });

    const ids = await prisma.$transaction(async (tx) => {
      const created: number[] = [];
      for (const slot of slots) {
        const { id: newId } = await createCalendarEventUnit(tx, {
          title: titleTrim,
          description: descTrim,
          start: slot.start,
          end: slot.end,
          eventType,
          userId,
          resolvedDeptId,
          deputyIdNum,
          is_private: !!is_private,
          location: locTrim,
          remindBefore,
          remindInApp: reminderInApp,
          remindEmail: reminderEmail,
          creatorName,
        });
        created.push(newId);
        if (participantUserIds.length > 0) {
          await replaceEventParticipants(tx, newId, participantUserIds);
        }
      }
      return created;
    });

    if (deputyIdNum !== null) {
      const notifMessage = `${creatorName} vytvořil/a událost „${titleTrim}“ (${getEventTypeLabel(eventType)}), která vyžaduje vaše schválení.`;
      const deputy = await prisma.users.findUnique({
        where: { id: deputyIdNum },
        select: { email: true, first_name: true, last_name: true },
      });
      if (deputy?.email) {
        for (const eid of ids) {
          await sendCalendarApprovalEmail({
            toEmail: deputy.email,
            toName: `${deputy.first_name} ${deputy.last_name}`.trim() || "Schvalovateli",
            subject: "Událost čeká na schválení – INTEGRAF",
            message: notifMessage,
            eventTitle: titleTrim,
            eventId: eid,
          });
        }
      }
    }

    if (participantUserIds.length > 0) {
      await notifyCalendarInvitees(prisma, {
        userIds: participantUserIds,
        eventId: ids[0]!,
        eventTitle: titleTrim,
        creatorName,
        extraHint:
          ids.length > 1
            ? `(Více termínů u opakující se události: celkem ${ids.length}.)`
            : undefined,
      });
    }

    return NextResponse.json({
      success: true,
      id: ids[0],
      ids,
      count: ids.length,
    });
  } catch (e) {
    console.error("Calendar POST error:", e);
    return NextResponse.json({ error: "Chyba při vytváření události" }, { status: 500 });
  }
}
