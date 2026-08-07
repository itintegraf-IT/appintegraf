"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileText,
  ClipboardList,
  CheckCircle,
  CalendarClock,
  Video,
  Presentation,
} from "lucide-react";
import {
  type MaterialType,
  materialTypeLabel,
  parseMaterialType,
} from "@/lib/training/material-types";

type Category = { id: number; name: string; color: string | null };

type Material = {
  id: number;
  title: string;
  source: string | null;
  category_id: number | null;
  material_type: string;
  question_categories: Category | null;
};

const MATERIAL_TABS: { type: MaterialType; label: string; icon: typeof FileText }[] = [
  { type: "text", label: "Texty", icon: FileText },
  { type: "video", label: "Videomateriály", icon: Video },
  { type: "presentation", label: "Prezentace", icon: Presentation },
];

type VisibleTest = {
  id: number;
  name: string;
  description: string | null;
  time_limit: number | null;
  pass_percentage: number | null;
  questionCount: number;
  passed: boolean;
  attemptsUsed: number;
  attemptsRemaining: number | null;
  bestScore: number | null;
  assignment: { end_date: Date | string | null } | null;
};

type Tab = "materials" | "tests";

function formatDate(date: Date | string | null): string | null {
  if (!date) return null;
  return new Date(date).toLocaleDateString("cs-CZ");
}

function tabClass(active: boolean) {
  return `inline-flex items-center gap-2 rounded-t-lg border px-5 py-2.5 text-sm font-medium transition-colors ${
    active
      ? "border-gray-200 border-b-white bg-white text-red-700"
      : "border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900"
  }`;
}

function materialTypeTabClass(active: boolean) {
  return `inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    active
      ? "bg-red-600 text-white"
      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
  }`;
}

export function TrainingOverviewClient({
  materials,
  categories,
  assignedTests,
  openTests,
}: {
  materials: Material[];
  categories: Category[];
  assignedTests: VisibleTest[];
  openTests: VisibleTest[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab: Tab = searchParams.get("tab") === "tests" ? "tests" : "materials";
  const [categoryId, setCategoryId] = useState<number | "all">("all");
  const [activeType, setActiveType] = useState<MaterialType>("text");

  const countsByType = useMemo(() => {
    const counts: Record<MaterialType, number> = { text: 0, video: 0, presentation: 0 };
    for (const m of materials) {
      counts[parseMaterialType(m.material_type)]++;
    }
    return counts;
  }, [materials]);

  const setTabWithUrl = useCallback(
    (next: Tab) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", next);
      router.replace(`/training?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      if (categoryId !== "all" && m.category_id !== categoryId) return false;
      if (parseMaterialType(m.material_type) !== activeType) return false;
      return true;
    });
  }, [materials, categoryId, activeType]);

  const materialLink = (id: number) => {
    const params = new URLSearchParams();
    if (categoryId !== "all") params.set("category", String(categoryId));
    const q = params.toString();
    return `/training/material/${id}${q ? `?${q}` : ""}`;
  };

  return (
    <>
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-1">
          <button
            type="button"
            onClick={() => setTabWithUrl("materials")}
            className={tabClass(tab === "materials")}
          >
            <FileText className="h-4 w-4" />
            Materiály
            {materials.length > 0 && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                {materials.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTabWithUrl("tests")}
            className={tabClass(tab === "tests")}
          >
            <ClipboardList className="h-4 w-4" />
            Testy
            {assignedTests.length + openTests.length > 0 && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                {assignedTests.length + openTests.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      <div className="rounded-b-xl rounded-tr-xl border border-gray-200 bg-white shadow-sm">
        {tab === "materials" ? (
          <>
            <div className="border-b border-gray-100 px-4 py-3">
              <nav className="mb-3 flex min-w-max gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-1">
                {MATERIAL_TABS.map((t) => {
                  const Icon = t.icon;
                  const active = activeType === t.type;
                  const count = countsByType[t.type];
                  return (
                    <button
                      key={t.type}
                      type="button"
                      onClick={() => setActiveType(t.type)}
                      className={materialTypeTabClass(active)}
                    >
                      <Icon className="h-4 w-4" />
                      {t.label}
                      {count > 0 && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            active ? "bg-red-500 text-white" : "bg-white text-gray-600"
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
              <div className="flex flex-wrap items-center gap-3">
                {categories.length > 0 && (
                  <>
                    <label htmlFor="material-category" className="text-sm font-medium text-gray-700">
                      Okruh:
                    </label>
                    <select
                      id="material-category"
                      value={categoryId}
                      onChange={(e) =>
                        setCategoryId(e.target.value === "all" ? "all" : parseInt(e.target.value, 10))
                      }
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                    >
                      <option value="all">Všechny okruhy</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                <span className="text-sm text-gray-500">
                  {filteredMaterials.length}{" "}
                  {filteredMaterials.length === 1 ? "materiál" : "materiálů"}
                </span>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {filteredMaterials.length === 0 ? (
                <div className="px-4 py-12 text-center text-gray-500">
                  {materials.length === 0
                    ? "Žádné materiály"
                    : `V záložce „${materialTypeLabel(activeType)}“ nejsou žádné materiály`}
                </div>
              ) : (
                filteredMaterials.map((m) => (
                  <div key={m.id} className="px-4 py-3 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">{m.title}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                          {m.question_categories && (
                            <span
                              className="inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white"
                              style={{
                                backgroundColor: m.question_categories.color ?? "#DC2626",
                              }}
                            >
                              {m.question_categories.name}
                            </span>
                          )}
                          {m.source && <span>Zdroj: {m.source}</span>}
                        </div>
                      </div>
                      <Link
                        href={materialLink(m.id)}
                        className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Zobrazit
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="divide-y divide-gray-100">
            {assignedTests.length > 0 && (
              <div>
                <div className="border-b border-gray-100 bg-gray-50 px-4 py-2.5">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <CalendarClock className="h-4 w-4 text-red-600" />
                    Přidělené testy
                  </h2>
                </div>
                {assignedTests.map((t) => (
                  <TestRow key={t.id} test={t} />
                ))}
              </div>
            )}
            <div>
              <div className="border-b border-gray-100 bg-gray-50 px-4 py-2.5">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <ClipboardList className="h-4 w-4 text-red-600" />
                  Volně dostupné testy
                </h2>
              </div>
              {openTests.length === 0 ? (
                <div className="px-4 py-12 text-center text-gray-500">Žádné testy</div>
              ) : (
                openTests.map((t) => <TestRow key={t.id} test={t} />)
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function TestRow({ test }: { test: VisibleTest }) {
  const endDate = formatDate(test.assignment?.end_date ?? null);
  const attemptsExhausted = test.attemptsRemaining !== null && test.attemptsRemaining <= 0;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50">
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-medium text-gray-900">
          {test.name}
          {test.passed && <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />}
        </p>
        {test.description && (
          <p className="text-sm text-gray-500 line-clamp-2">{test.description}</p>
        )}
        <p className="mt-1 text-xs text-gray-400">
          {test.questionCount} otázek | Čas: {test.time_limit ?? 30} min
          {test.pass_percentage != null && ` | Pro splnění: ${test.pass_percentage}%`}
          {endDate && ` | Termín do: ${endDate}`}
          {test.attemptsRemaining !== null && ` | Zbývá pokusů: ${test.attemptsRemaining}`}
          {test.bestScore !== null && ` | Nejlepší skóre: ${test.bestScore}%`}
        </p>
      </div>
      {attemptsExhausted ? (
        <span className="shrink-0 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-500">
          Vyčerpáno
        </span>
      ) : (
        <Link
          href={`/training/test/${test.id}`}
          className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
        >
          {test.attemptsUsed > 0 ? "Opakovat" : "Spustit"}
        </Link>
      )}
    </div>
  );
}
