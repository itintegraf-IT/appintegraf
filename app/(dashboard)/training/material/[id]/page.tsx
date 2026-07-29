import { notFound } from "next/navigation";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { type MaterialNavItem } from "@/lib/training/material-nav";
import { getMaterialFile } from "@/lib/training/material-api";
import { MaterialReader } from "./MaterialReader";

export default async function MaterialPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const id = parseInt((await params).id, 10);
  if (isNaN(id)) notFound();

  const sp = await searchParams;
  const categoryParam = sp.category ? parseInt(sp.category, 10) : null;
  const initialCategoryId =
    categoryParam !== null && !isNaN(categoryParam) ? categoryParam : null;

  const [material, allRows, categories, file] = await Promise.all([
    prisma.learning_materials.findUnique({
      where: { id },
      include: { question_categories: true },
    }),
    prisma.learning_materials.findMany({
      include: { question_categories: { select: { name: true } } },
      orderBy: { title: "asc" },
    }),
    prisma.question_categories.findMany({
      where: { learning_materials: { some: {} } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    getMaterialFile(id),
  ]);

  if (!material) notFound();

  const allMaterials: MaterialNavItem[] = allRows.map((m) => ({
    id: m.id,
    title: m.title,
    categoryId: m.category_id,
    categoryName: m.question_categories?.name ?? null,
  }));

  return (
    <Suspense fallback={<div className="text-gray-500">Načítání materiálu…</div>}>
      <MaterialReader
        material={material}
        file={file}
        allMaterials={allMaterials}
        categories={categories}
        initialCategoryId={initialCategoryId}
      />
    </Suspense>
  );
}
