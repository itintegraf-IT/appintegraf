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

type MaterialTypeFilter = "all" | MaterialType;

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

function TypeBadge({ type }: { type: MaterialType }) {
  const label = materialTypeLabel(type);
  const Icon = type === "video" ? Video : type === "presentation" ? Presentation : FileText;
  const colors =
    type === "video"
      ? "bg-purple-100 text-purple-800"
      : type === "presentation"
        ? "bg-blue-100 text-blue-800"
        : "bg-gray-100 text-gray-700";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${colors}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
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
  const [typeFilter, setTypeFilter] = useState<MaterialTypeFilter>("all");

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
      if (typeFilter !== "all" && parseMaterialType(m.material_type) !== typeFilter) return false;
      return true;
    });
  }, [materials, categoryId, typeFilter]);

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
            <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-3">
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
              <label htmlFor="material-type" className="text-sm font-medium text-gray-700">
                Typ:
              </label>
              <select
                id="material-type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as MaterialTypeFilter)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              >
                <option value="all">Vše</option>
                <option value="text">Text</option>
                <option value="video">Video</option>
                <option value="presentation">Prezentace</option>
              </select>
              <span className="text-sm text-gray-500">
                {filteredMaterials.length}{" "}
                {filteredMaterials.length === 1 ? "materiál" : "materiálů"}
              </span>
            </div>
            <div className="divide-y divide-gray-100">
              {filteredMaterials.length === 0 ? (
                <div className="px-4 py-12 text-center text-gray-500">
                  {categoryId === "all" && typeFilter === "all"
                    ? "Žádné materiály"
                    : "Pro zvolené filtry nejsou žádné materiály"}
                </div>
              ) : (
                filteredMaterials.map((m) => (
                  <div key={m.id} className="px-4 py-3 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">{m.title}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                          <TypeBadge type={parseMaterialType(m.material_type)} />
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
