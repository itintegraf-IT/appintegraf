import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess, isAdmin } from "@/lib/auth-utils";

function formatIcsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcs(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Neautorizováno", { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "calendar", "read"))) {
    return new NextResponse("Nemáte oprávnění", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") === "all" && (await isAdmin(userId)) ? "all" : "mine";

  const where =
    scope === "all"
      ? { is_private: { not: true } as const }
      : { created_by: userId };
  const events = await prisma.calendar_events.findMany({
    where,
    orderBy: { start_date: "asc" },
    take: 500,
  });

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//INTEGRAF//Calendar Export//CS",
    "CALSCALE:GREGORIAN",
  ];

  for (const e of events) {
    const start = formatIcsDate(new Date(e.start_date));
    const end = formatIcsDate(new Date(e.end_date));
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:event-${e.id}@appintegraf`);
    lines.push(`DTSTAMP:${formatIcsDate(new Date())}`);
    lines.push(`DTSTART:${start}`);
    lines.push(`DTEND:${end}`);
    lines.push(`SUMMARY:${escapeIcs(e.title)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeIcs(e.description)}`);
    if (e.location) lines.push(`LOCATION:${escapeIcs(e.location)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  const ics = lines.join("\r\n");
  const filename = `calendar_${scope}_${new Date().toISOString().slice(0, 10)}.ics`;

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
