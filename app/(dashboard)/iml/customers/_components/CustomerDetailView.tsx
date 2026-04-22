"use client";

import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { Tabs, type TabDef } from "../../_components/Tabs";
import {
  SectionShell,
  useViewMode,
  ViewToggle,
} from "../../_components/ViewToggle";

export type DetailSection = {
  id: string;
  label: string;
  subtitle?: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
  hidden?: boolean;
  badge?: string | number | null;
};

/**
 * Klientský wrapper pro detail zákazníka. Přijímá z server komponenty:
 *  - title / customerId / canWrite - pro header (titulek, tlačítka Upravit/Zpět)
 *  - stats - volitelný JSX blok statistik nad sekcemi
 *  - sections - pole sekcí k zobrazení
 *  - legacyShippingAddress - pokud vyplněno, zobrazí amber banner pod obsahem
 *
 * Persistuje volbu "sections / tabs" v localStorage (klíč `iml.viewMode.customerDetail`).
 */
export default function CustomerDetailView({
  title,
  customerId,
  canWrite,
  stats,
  sections,
  legacyShippingAddress,
}: {
  title: string;
  customerId: number;
  canWrite: boolean;
  stats?: React.ReactNode;
  sections: DetailSection[];
  legacyShippingAddress?: string | null;
}) {
  const [mode, setMode] = useViewMode("customerDetail");
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
          <p className="mt-1 text-gray-600">Detail zákazníka</p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle mode={mode} onChange={setMode} />
          {canWrite && (
            <Link
              href={`/iml/customers/${customerId}/edit`}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Upravit
            </Link>
          )}
          <Link
            href="/iml/customers"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Zpět
          </Link>
        </div>
      </div>

      {stats && <div className="mb-6">{stats}</div>}

      {mode === "tabs" ? (
        <Tabs tabs={tabDefs} storageKey="customerDetail" />
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

      {legacyShippingAddress && legacyShippingAddress.trim() !== "" && (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <strong>Legacy pole „Doručovací adresa":</strong> Zákazník má vyplněné
              staré jednořádkové pole, které bylo nahrazeno sekcí „Doručovací adresy"
              výše.
              <p className="mt-1 whitespace-pre-wrap rounded border border-amber-200 bg-white px-2 py-1 text-xs text-gray-700">
                {legacyShippingAddress}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
