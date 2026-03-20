import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth-utils";
import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  Users,
  Phone,
  Laptop,
  Calendar,
  Tv,
  GraduationCap,
  BarChart3,
  UserCog,
  Mail,
} from "lucide-react";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    redirect("/contacts?error=Nemáte oprávnění");
  }

  const [usersCount, equipmentCount, eventsCount, presentationsCount, testsCount] =
    await Promise.all([
      prisma.users.count(),
      prisma.equipment_items.count(),
      prisma.calendar_events.count(),
      prisma.presentations.count({ where: { is_active: true } }),
      prisma.tests.count({ where: { is_active: true } }),
    ]);

  const cards = [
    { href: "/contacts", icon: Users, label: "Kontakty", value: usersCount, color: "bg-blue-500" },
    { href: "/equipment", icon: Laptop, label: "Majetek", value: equipmentCount, color: "bg-green-500" },
    { href: "/calendar", icon: Calendar, label: "Události", value: eventsCount, color: "bg-amber-500" },
    { href: "/kiosk", icon: Tv, label: "Prezentace", value: presentationsCount, color: "bg-purple-500" },
    { href: "/training", icon: GraduationCap, label: "Testy", value: testsCount, color: "bg-teal-500" },
  ];

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <UserCog className="h-7 w-7 text-red-600" />
            Administrace
          </h1>
          <p className="mt-1 text-gray-600">Přehled systému a správa</p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/admin/users"
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          Uživatelé
        </Link>
        <Link
          href="/admin/departments"
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          Oddělení
        </Link>
        <Link
          href="/admin/roles"
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          Role
        </Link>
        <Link
          href="/admin/settings/email"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <Mail className="h-4 w-4" />
          Nastavení e-mailu
        </Link>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className={`rounded-lg p-3 ${card.color}`}>
                <Icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
          <BarChart3 className="h-5 w-5 text-red-600" />
          Reporty a audit
        </h2>
        <div className="space-y-2">
          <Link
            href="/admin/reports"
            className="block rounded-lg border border-gray-200 p-4 hover:bg-gray-50"
          >
            <p className="font-medium text-gray-900">Audit log</p>
            <p className="text-sm text-gray-500">Historie změn v systému</p>
          </Link>
        </div>
      </div>
    </>
  );
}
