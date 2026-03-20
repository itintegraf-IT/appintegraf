import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ArrowLeft, Pencil, Image as ImageIcon } from "lucide-react";

export default async function KioskViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = parseInt((await params).id, 10);
  if (isNaN(id)) notFound();

  const presentation = await prisma.presentations.findUnique({
    where: { id },
    include: { slides: { orderBy: { sort_order: "asc" }, where: { visible: true } } },
  });

  if (!presentation) notFound();

  type SlideRow = { id: number; file_type: string; file_path: string; title: string | null; filename: string };
  const slidesTyped = presentation.slides as SlideRow[];

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{presentation.name}</h1>
          <p className="mt-1 text-gray-600">Detail prezentace</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/kiosk/${id}/edit`}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            <Pencil className="h-4 w-4" />
            Upravit
          </Link>
          <Link
            href="/kiosk"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Zpět
          </Link>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-gray-600">{presentation.description ?? "-"}</p>
          <p className="mt-4 text-sm text-gray-500">
            Snímků: {slidesTyped.length} | Přechod: {presentation.transition_effect ?? "fade"}{" "}
            | Délka: {presentation.display_duration}s
          </p>
        </div>

        {slidesTyped.length > 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Snímky</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {slidesTyped.map((slide, idx) => (
                <div
                  key={slide.id}
                  className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                >
                  <div className="relative aspect-video bg-gray-200">
                    {slide.file_type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={slide.file_path}
                        alt={slide.title ?? slide.filename}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ImageIcon className="h-12 w-12 text-gray-400" />
                      </div>
                    )}
                    <span className="absolute left-2 top-2 rounded bg-black/50 px-2 py-0.5 text-xs text-white">
                      {idx + 1}
                    </span>
                  </div>
                  <p className="truncate p-2 text-sm font-medium text-gray-900">
                    {slide.title || slide.filename}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
            <p className="text-gray-500">Žádné snímky. Přidejte je v editaci prezentace.</p>
            <Link
              href={`/kiosk/${id}/edit`}
              className="mt-2 inline-block text-red-600 hover:underline"
            >
              Upravit prezentaci →
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
