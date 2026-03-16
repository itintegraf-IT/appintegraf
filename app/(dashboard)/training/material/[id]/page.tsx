import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ArrowLeft } from "lucide-react";

export default async function MaterialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = parseInt((await params).id, 10);
  if (isNaN(id)) notFound();

  const material = await prisma.learning_materials.findUnique({
    where: { id },
    include: { question_categories: true },
  });

  if (!material) notFound();

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{material.title}</h1>
          <p className="mt-1 text-gray-600">Materiál ke školení</p>
        </div>
        <Link
          href="/training"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        {material.source && (
          <p className="mb-4 text-sm text-gray-500">Zdroj: {material.source}</p>
        )}
        <div className="prose max-w-none">
          <div className="whitespace-pre-wrap text-gray-700">{material.content}</div>
        </div>
      </div>
    </>
  );
}
