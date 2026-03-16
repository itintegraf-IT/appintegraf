import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess, isAdmin } from "@/lib/auth-utils";
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
} from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;

  const [stats, contactsRead, equipmentRead, calendarRead, kioskRead, trainingRead, trainingWrite, contactsWrite, equipmentWrite, kioskWrite] =
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

      {/* Statistiky */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100 text-red-600">
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
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600">
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
                  className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
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
