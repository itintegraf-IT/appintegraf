"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, FileText, Video, Presentation } from "lucide-react";
import {
  filterMaterialsByCategory,
  getMaterialNavPosition,
  type MaterialNavItem,
} from "@/lib/training/material-nav";
import { materialTypeLabel, parseMaterialType } from "@/lib/training/material-types";
import type { MaterialFileMeta } from "@/lib/training/material-shared";
import { MaterialMediaContent } from "./MaterialMediaContent";

type Category = { id: number; name: string; color: string | null };

type Props = {
  material: {
    id: number;
    title: string;
    content: string;
    source: string | null;
    category_id: number | null;
    material_type: string;
    media_url: string | null;
    question_categories: Category | null;
  };
  file: MaterialFileMeta | null;
  allMaterials: MaterialNavItem[];
  categories: Category[];
  initialCategoryId: number | null;
};

function materialUrl(id: number, categoryId: number | null) {
  if (categoryId === null) return `/training/material/${id}`;
  return `/training/material/${id}?category=${categoryId}`;
}

function TypeLabel({ type }: { type: ReturnType<typeof parseMaterialType> }) {
  const Icon = type === "video" ? Video : type === "presentation" ? Presentation : FileText;
  return (
    <span className="inline-flex items-center gap-1 text-sm text-gray-500">
      <Icon className="h-4 w-4" />
      {materialTypeLabel(type)}
    </span>
  );
}

export function MaterialReader({
  material,
  file,
  allMaterials,
  categories,
  initialCategoryId,
}: Props) {
  const router = useRouter();
  const categoryId = initialCategoryId;
  const materialType = parseMaterialType(material.material_type);

  const filtered = filterMaterialsByCategory(allMaterials, categoryId);
  const nav = getMaterialNavPosition(filtered, material.id);

  const onCategoryChange = (value: string) => {
    const nextCategory = value === "all" ? null : parseInt(value, 10);
    const nextList = filterMaterialsByCategory(allMaterials, nextCategory);
    const target =
      nextList.find((m) => m.id === material.id)?.id ?? nextList[0]?.id ?? material.id;
    router.push(materialUrl(target, nextCategory));
  };

  const onMaterialSelect = (id: number) => {
    router.push(materialUrl(id, categoryId));
  };

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{material.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <TypeLabel type={materialType} />
            {material.question_categories && (
              <span
                className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                style={{
                  backgroundColor: material.question_categories.color ?? "#DC2626",
                }}
              >
                {material.question_categories.name}
              </span>
            )}
            {nav.total > 0 && nav.index >= 0 && (
              <span className="text-sm text-gray-400">
                {nav.index + 1} / {nav.total}
              </span>
            )}
          </div>
        </div>

        <Link
          href="/training?tab=materials"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět na přehled
        </Link>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-center">
        {categories.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="reader-category" className="text-sm font-medium text-gray-700">
              Okruh:
            </label>
            <select
              id="reader-category"
              value={categoryId ?? "all"}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="all">Všechny okruhy</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {filtered.length > 1 && (
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-md">
            <label htmlFor="reader-material" className="shrink-0 text-sm font-medium text-gray-700">
              Materiál:
            </label>
            <select
              id="reader-material"
              value={material.id}
              onChange={(e) => onMaterialSelect(parseInt(e.target.value, 10))}
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            >
              {filtered.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.categoryName ? `[${m.categoryName}] ` : ""}
                  {m.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        {material.source && (
          <p className="mb-4 text-sm text-gray-500">Zdroj: {material.source}</p>
        )}
        <MaterialMediaContent
          materialId={material.id}
          materialType={material.material_type}
          content={material.content}
          mediaUrl={material.media_url}
          file={file}
        />
      </div>

      {(nav.prevId !== null || nav.nextId !== null) && (
        <div className="mt-4 flex items-center justify-between gap-3">
          {nav.prevId !== null ? (
            <Link
              href={materialUrl(nav.prevId, categoryId)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Předchozí
            </Link>
          ) : (
            <span />
          )}
          {nav.nextId !== null ? (
            <Link
              href={materialUrl(nav.nextId, categoryId)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Další
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </>
  );
}
