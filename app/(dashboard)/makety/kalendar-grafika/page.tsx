import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasMaketyGrafikaAccess } from "@/lib/auth-utils";
import { canViewAllMaketyTypes } from "@/lib/makety-access";
import { WeekCalendarGrid } from "@/app/(dashboard)/calendar/WeekCalendarGrid";
import { MaketyCalendarNav } from "../kalendar/MaketyCalendarNav";
import { formatDateLocal, getWeekStart, getWeekEnd } from "@/app/(dashboard)/calendar/lib/week-utils";
import { getHolidaysForRange } from "@/app/(dashboard)/calendar/lib/holidays";
import { fetchMaketyForCalendarRange } from "@/lib/makety-calendar";

export const dynamic = "force-dynamic";

export default async function MaketyKalendarGrafikaPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await hasMaketyGrafikaAccess(userId)) && !(await canViewAllMaketyTypes(userId))) {
    redirect("/makety");
  }

  const params = await searchParams;
  const weekStart = getWeekStart(new Date());
  const from = params.from ?? formatDateLocal(weekStart);
  const to = params.to ?? formatDateLocal(getWeekEnd(weekStart));

  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T23:59:59`);

  const maketyItems = await fetchMaketyForCalendarRange({
    fromDate,
    toDate,
    userId,
    mode: "grafika",
  });

  const events = maketyItems.map((m) => ({
    ...m,
    start_date: new Date(m.start_date),
    end_date: new Date(m.end_date),
  }));

  const holidays = getHolidaysForRange(from, to);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Přehled aktivních zakázek grafiky podle termínu. Pořadí a priorita z Fronty výroby (záložka Grafika)
        se berou při načtení stránky (priorita = barva pruhu). Kliknutím na položku otevřete detail.
      </p>
      <MaketyCalendarNav from={from} to={to} basePath="/makety/kalendar-grafika" />
      <WeekCalendarGrid
        events={events}
        holidays={holidays}
        from={from}
        to={to}
        userId={userId}
        eventMetaMode="hidden"
      />
    </div>
  );
}
