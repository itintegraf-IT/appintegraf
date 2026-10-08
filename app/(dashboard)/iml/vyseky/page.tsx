import Link from "next/link";
import { redirect } from "next/navigation";
import { Layers, Scissors, Wrench, LayoutGrid } from "lucide-react";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";

export default async function ImVysekyHubPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) redirect("/iml");

  const [shapesCount, toolsCount, impositionsCount, legacyCount] = await Promise.all([
    prisma.iml_shape_catalog.count(),
    prisma.iml_tool_catalog.count(),
    prisma.iml_imposition_catalog.count(),
    prisma.iml_die_cuts.count({ where: { is_active: true } }),
  ]);

  const cards = [
    {
      href: "/iml/shapes",
      icon: LayoutGrid,
      title: "Tvary",
      value: shapesCount,
      desc: "Geometrie etikety (Š × V), typ, přiřazení nástrojů",
    },
    {
      href: "/iml/tools",
      icon: Wrench,
      title: "Nástroje",
      value: toolsCount,
      desc: "Fyzická železa / plechy (Montex, Atlas, …)",
    },
    {
      href: "/iml/impositions",
      icon: Layers,
      title: "Montáže",
      value: impositionsCount,
      desc: "Musters Fénix / Equios, počet užitků",
    },
    {
      href: "/iml/die-cuts",
      icon: Scissors,
      title: "Výseky (legacy)",
      value: legacyCount,
      desc: "Starý monolitický katalog — dočasný bridge",
      muted: true,
    },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/iml" className="text-sm text-violet-700 hover:underline">
          ← IML
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Layers className="h-7 w-7 text-red-600" />
          Výseky
        </h1>
        <p className="mt-1 text-gray-600">
          Tříúrovňový katalog: tvar → nástroj → montáž
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className={`rounded-xl border bg-white p-5 shadow-sm transition hover:border-violet-300 hover:shadow ${
              "muted" in c && c.muted
                ? "border-amber-200 opacity-90"
                : "border-gray-200"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <c.icon
                className={`h-6 w-6 ${
                  "muted" in c && c.muted ? "text-amber-600" : "text-violet-600"
                }`}
              />
              <span className="text-2xl font-bold text-gray-900">{c.value}</span>
            </div>
            <h2 className="mt-3 text-base font-semibold text-gray-900">{c.title}</h2>
            <p className="mt-1 text-sm text-gray-600">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
