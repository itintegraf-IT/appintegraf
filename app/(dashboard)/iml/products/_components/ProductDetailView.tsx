"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
 *  - preview - volitelný blok (obrázek + PDF) nad sekcemi
 *  - sections - pole sekcí k zobrazení
 *
 * Persistuje volbu "sections / tabs" v localStorage
 * (klíč `iml.viewMode.productDetail`).
 */
export default function ProductDetailView({
  title,
  subtitle,
  productId,
  canWrite,
  preview,
  sections,
}: {
  title: string;
  subtitle?: React.ReactNode;
  productId: number;
  canWrite: boolean;
  preview?: React.ReactNode;
  sections: ProductDetailSection[];
}) {
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="mt-1 text-gray-600">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
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

      {preview && <div className="mb-6">{preview}</div>}

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
    </>
  );
}
