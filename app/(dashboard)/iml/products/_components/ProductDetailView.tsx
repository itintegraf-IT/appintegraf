"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, FileText, ImageOff, X } from "lucide-react";
import { Tabs, type TabDef } from "../../_components/Tabs";
import {
  SectionShell,
  useViewMode,
  ViewToggle,
} from "../../_components/ViewToggle";

export type ProductDetailSection = {
  id: string;
  label: string;
  subtitle?: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
  hidden?: boolean;
  badge?: string | number | null;
};

/**
 * Klientský wrapper pro detail produktu. Přijímá ze server komponenty:
 *  - title + subtitle - hlavička
 *  - productId / canWrite - pro tlačítko Upravit
 *  - hasImage / hasPdf - zda jsou k dispozici náhled / tisková data
 *  - sections - pole sekcí k zobrazení
 *
 * Miniatura obrázku je v hlavičce vedle titulku (klikem se otevře
 * lightbox / odkaz na plný obrázek). PDF se otevírá v novém tabu.
 *
 * Persistuje volbu "sections / tabs" v localStorage
 * (klíč `iml.viewMode.productDetail`).
 */
export default function ProductDetailView({
  title,
  subtitle,
  productId,
  canWrite,
  hasImage,
  hasPdf,
  sections,
}: {
  title: string;
  subtitle?: React.ReactNode;
  productId: number;
  canWrite: boolean;
  hasImage: boolean;
  hasPdf: boolean;
  sections: ProductDetailSection[];
}) {
  const [imageOpen, setImageOpen] = useState(false);
  const [mode, setMode] = useViewMode("productDetail");
  const visible = sections.filter((s) => !s.hidden);

  const tabDefs: TabDef[] = visible.map((s) => ({
    id: s.id,
    label: s.label,
    icon: s.icon,
    badge: s.badge,
    content: (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        {s.subtitle && (
          <p className="mb-4 border-b border-gray-100 pb-3 text-sm text-gray-500">
            {s.subtitle}
          </p>
        )}
        {s.content}
      </div>
    ),
  }));

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {hasImage ? (
            <button
              type="button"
              onClick={() => setImageOpen(true)}
              className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:border-red-400"
              title="Kliknutím zvětšit"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/iml/products/${productId}/image`}
                alt="Náhled produktu"
                className="h-full w-full object-contain"
              />
              <span className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/5" />
            </button>
          ) : (
            <div
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-gray-300"
              title="Bez náhledu"
            >
              <ImageOff className="h-6 w-6" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            {subtitle && <p className="mt-1 text-gray-600">{subtitle}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasPdf && (
            <a
              href={`/api/iml/products/${productId}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
              title="Otevřít PDF v novém okně"
            >
              <FileText className="h-4 w-4" />
              Tisková data
            </a>
          )}
          <ViewToggle mode={mode} onChange={setMode} />
          {canWrite && (
            <Link
              href={`/iml/products/${productId}/edit`}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Upravit
            </Link>
          )}
          <Link
            href="/iml/products"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Zpět
          </Link>
        </div>
      </div>

      {mode === "tabs" ? (
        <Tabs tabs={tabDefs} storageKey="productDetail" />
      ) : (
        <div className="space-y-6">
          {visible.map((s) => (
            <SectionShell
              key={s.id}
              title={s.label}
              subtitle={s.subtitle}
              mode={mode}
            >
              {s.content}
            </SectionShell>
          ))}
        </div>
      )}

      {imageOpen && hasImage && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setImageOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setImageOpen(false);
            }}
            className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-gray-700 shadow hover:bg-white"
            title="Zavřít"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/iml/products/${productId}/image`}
            alt="Náhled produktu"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[95vw] rounded-lg bg-white object-contain shadow-2xl"
          />
        </div>
      )}
    </>
  );
}
