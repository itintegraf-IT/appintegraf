import Link from "next/link";
import { prisma } from "@/lib/db";
import { BookOpen, FileText, Plus, ClipboardList } from "lucide-react";
import { TrainingSuccessBanner } from "./TrainingSuccessBanner";

export default async function TrainingPage() {
  const [tests, materials] = await Promise.all([
    prisma.tests.findMany({
      where: { is_active: true },
      orderBy: { name: "asc" },
      take: 50,
    }),
    prisma.learning_materials.findMany({
      orderBy: { title: "asc" },
      take: 50,
    }),
  ]);

  type TestRow = { id: number; name: string; description: string | null; time_limit: number | null; pass_percentage: number | null };
  type MaterialRow = { id: number; title: string; source: string | null };
  const testsTyped = tests as TestRow[];
  const materialsTyped = materials as MaterialRow[];

  return (
    <>
      <TrainingSuccessBanner />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <BookOpen className="h-7 w-7 text-red-600" />
            IT Školení
          </h1>
          <p className="mt-1 text-gray-600">Testy a materiály ke školení</p>
        </div>
        <Link
          href="/training/create-test"
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
        >
          <Plus className="h-4 w-4" />
          Nový test
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
            <h2 className="flex items-center gap-2 font-semibold text-gray-900">
              <ClipboardList className="h-5 w-5 text-red-600" />
              Testy
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {testsTyped.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">Žádné testy</div>
            ) : (
              tests.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <div>
                    <p className="font-medium text-gray-900">{t.name}</p>
                    {t.description && (
                      <p className="text-sm text-gray-500 line-clamp-2">{t.description}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-400">
                      Čas: {t.time_limit ?? 30} min
                      {t.pass_percentage != null && ` | Pro splnění: ${t.pass_percentage}%`}
                    </p>
                  </div>
                  <Link
                    href={`/training/test/${t.id}`}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Spustit
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
            <h2 className="flex items-center gap-2 font-semibold text-gray-900">
              <FileText className="h-5 w-5 text-red-600" />
              Materiály
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {materialsTyped.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">Žádné materiály</div>
            ) : (
              materialsTyped.map((m) => (
                <div key={m.id} className="px-4 py-3 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900">{m.title}</p>
                      {m.source && (
                        <p className="text-sm text-gray-500">Zdroj: {m.source}</p>
                      )}
                    </div>
                    <Link
                      href={`/training/material/${m.id}`}
                      className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Zobrazit
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
