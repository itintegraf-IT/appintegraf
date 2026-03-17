import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess, isAdmin } from "@/lib/auth-utils";
import { NotificationLink } from "./NotificationLink";
import {
  LayoutDashboard,
  Users,
  Building2,
  Laptop,
  Tv,
  Contact,
  Calendar,
  Phone,
  GraduationCap,
  UserPlus,
  PlusCircle,
  CalendarPlus,
  FileText,
  ClipboardList,
  Clock,
  ChevronRight,
  Bell,
} from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;

  const [stats, contactsRead, equipmentRead, calendarRead, kioskRead, trainingRead, trainingWrite, contactsWrite, equipmentWrite, kioskWrite, pendingEvents, notifications] =
    await Promise.all([
      Promise.all([
        prisma.users.count({ where: { is_active: true } }),
        prisma.departments.count({ where: { is_active: true } }),
        prisma.equipment_items.count(),
        prisma.presentations.count({ where: { is_active: true } }),
      ]).then(([users, departments, equipment, presentations]) => ({
        users,
        departments,
        equipment,
        presentations,
      })),
      hasModuleAccess(userId, "contacts", "read"),
      hasModuleAccess(userId, "equipment", "read"),
      hasModuleAccess(userId, "calendar", "read"),
      hasModuleAccess(userId, "kiosk", "read"),
      hasModuleAccess(userId, "training", "read"),
      hasModuleAccess(userId, "training", "write"),
      hasModuleAccess(userId, "contacts", "write"),
      hasModuleAccess(userId, "equipment", "write"),
      hasModuleAccess(userId, "kiosk", "write"),
      (async () => {
        if (userId === 0) return [];
        const canReadCalendar = await hasModuleAccess(userId, "calendar", "read");
        if (!canReadCalendar) return [];
        const managerDeptIds = await prisma.departments
          .findMany({ where: { manager_id: userId }, select: { id: true } })
          .then((r) => r.map((d) => d.id));
        const events = await prisma.calendar_events.findMany({
          where: {
            OR: [
              { deputy_id: userId, approval_status: "pending" },
              ...(managerDeptIds.length > 0
                ? [{
                    approval_status: "deputy_approved",
                    OR: [
                      { department_id: { in: managerDeptIds } },
                      { users: { department_id: { in: managerDeptIds } } },
                    ],
                  }]
                : []),
            ],
          },
          orderBy: { start_date: "asc" },
          take: 10,
          include: {
            users: { select: { first_name: true, last_name: true } },
          },
        });
        return events;
      })(),
      (async () => {
        if (userId === 0) return [];
        return prisma.notifications.findMany({
          where: { user_id: userId, read_at: null },
          orderBy: { created_at: "desc" },
          take: 10,
        });
      })(),
    ]);

  const statCards = [
    { icon: Users, value: stats.users, label: "Uživatelé" },
    { icon: Building2, value: stats.departments, label: "Oddělení" },
    { icon: Laptop, value: stats.equipment, label: "Vybavení" },
    { icon: Tv, value: stats.presentations, label: "Prezentace" },
  ];

  const modules = [
    { href: "/contacts", icon: Contact, label: "Kontakty", desc: "Evidence osob, oddělení a kontaktů", show: contactsRead },
    { href: "/equipment", icon: Laptop, label: "Majetek", desc: "Evidence vybavení a požadavky", show: equipmentRead },
    { href: "/calendar", icon: Calendar, label: "Kalendář", desc: "Kalendář událostí s workflow schvalováním", show: calendarRead },
    { href: "/phone-list", icon: Phone, label: "Telefonní seznam", desc: "Kontakty zaměstnanců", show: true },
    { href: "/public/phone-list", icon: Phone, label: "Veřejný telefonní seznam", desc: "Bez přihlášení", show: true },
    { href: "/public/equipment-request", icon: ClipboardList, label: "Požadavek na techniku", desc: "Veřejný formulář", show: true },
    { href: "/kiosk", icon: Tv, label: "Kiosk Monitory", desc: "Správa prezentací pro monitory", show: kioskRead },
    { href: "/training", icon: GraduationCap, label: "IT Bezpečnostní školení", desc: "Testy a vzdělávání zaměstnanců", show: trainingRead },
  ];

  const quickActions = [
    { href: "/contacts/add", icon: UserPlus, label: "Přidat kontakt", show: contactsWrite },
    { href: "/equipment/add", icon: Laptop, label: "Přidat vybavení", show: equipmentWrite },
    { href: "/kiosk/create", icon: PlusCircle, label: "Nová prezentace", show: kioskWrite },
    { href: "/calendar/add", icon: CalendarPlus, label: "Nová událost", show: calendarRead },
    { href: "/training/create-test", icon: FileText, label: "Nový test", show: trainingWrite },
  ];

  return (
    <>
      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <LayoutDashboard className="h-7 w-7 text-red-600" />
          Dashboard
        </h1>
        <p className="mt-1 text-gray-600">Vítejte v systému INTEGRAF</p>
      </div>

      {/* Notifikace */}
      {notifications.length > 0 && (
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-elevated">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Bell className="h-5 w-5 text-gray-600" />
            Notifikace ({notifications.length})
          </h2>
          <div className="space-y-2">
            {notifications.map((n) => (
              <NotificationLink
                key={n.id}
                id={n.id}
                title={n.title}
                message={n.message}
                link={n.link}
                readAt={n.read_at}
                createdAt={n.created_at}
              />
            ))}
          </div>
        </div>
      )}

      {/* Události ke schválení */}
      {calendarRead && pendingEvents.length > 0 && (
        <div className="mb-8 rounded-xl border-2 border-amber-200 bg-amber-50/50 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-amber-900">
            <Clock className="h-5 w-5 text-amber-600" />
            Události ke schválení ({pendingEvents.length})
          </h2>
          <div className="space-y-3">
            {pendingEvents.map((e) => {
              const creatorName = e.users
                ? `${e.users.first_name} ${e.users.last_name}`
                : "–";
              const startDate = new Date(e.start_date);
              const statusLabel =
                e.approval_status === "pending"
                  ? "Jako zástup"
                  : "Jako vedoucí oddělení";
              return (
                <Link
                  key={e.id}
                  href={`/calendar/${e.id}`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-white p-4 transition-colors hover:border-amber-400 hover:bg-amber-50/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">{e.title}</p>
                    <p className="mt-0.5 text-sm text-gray-600">
                      {creatorName} • {startDate.toLocaleDateString("cs-CZ", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    <span className="mt-2 inline-block rounded bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-900">
                      {statusLabel}
                    </span>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-amber-600" />
                </Link>
              );
            })}
          </div>
          <Link
            href="/calendar?scope=mine"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-amber-800 hover:text-amber-900"
          >
            Zobrazit všechny v kalendáři
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {/* Statistiky */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-card transition-all hover:shadow-card-hover"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg icon-card-accent">
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Moduly */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Moduly</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules
            .filter((m) => m.show)
            .map((mod) => {
              const Icon = mod.icon;
              return (
                <Link
                  key={mod.href}
                  href={mod.href}
                  className="flex gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-red-200 hover:bg-red-50/50"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg icon-card-accent">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900">{mod.label}</h3>
                    <p className="mt-0.5 text-sm text-gray-500">{mod.desc}</p>
                    <span className="mt-2 inline-flex items-center text-sm font-medium text-red-600">
                      Otevřít →
                    </span>
                  </div>
                </Link>
              );
            })}
        </div>
      </div>

      {/* Rychlé akce */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
          Rychlé akce
        </h2>
        <div className="flex flex-wrap gap-3">
          {quickActions
            .filter((a) => a.show)
            .map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-card transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600 hover:shadow-md"
                >
                  <Icon className="h-4 w-4" />
                  {action.label}
                </Link>
              );
            })}
        </div>
      </div>
    </>
  );
}
