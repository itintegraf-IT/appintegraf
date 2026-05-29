"use client";

import Link from "next/link";
import { Building2, MapPin, Pencil } from "lucide-react";

export type BranchListItem = {
  id: number;
  name: string;
  unit_type: string;
  city: string | null;
  postal_code?: string | null;
  email: string | null;
  primary_email?: string | null;
  phone: string | null;
  contact_person?: string | null;
  billing_address?: string | null;
  shipping_addresses_count?: number;
};

type Props = {
  headquartersId: number;
  unitType: string;
  branches: BranchListItem[];
  canWrite?: boolean;
};

export default function CustomerBranchesPanel({
  headquartersId,
  unitType,
  branches,
  canWrite = true,
}: Props) {
  const canShow =
    unitType === "standalone" || unitType === "headquarters" || branches.length > 0;

  if (!canShow) return null;

  const editHref = `/iml/customers/${headquartersId}/edit`;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Pobočky skupiny</h2>
        </div>
        {canWrite && (
          <Link
            href={editHref}
            className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          >
            <Pencil className="h-4 w-4" />
            Spravovat ve formuláři
          </Link>
        )}
      </div>

      <p className="mb-4 text-sm text-gray-500">
        Pobočky, kontakty a doručovací adresy upravíte v jednom formuláři se zákazníkem
        (zaškrtnutí Centrála a karta Pobočky).
      </p>

      {branches.length > 0 ? (
        <ul className="divide-y divide-gray-100">
          {branches.map((b) => (
            <li key={b.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/iml/customers/${b.id}`}
                  className="font-medium text-red-700 hover:underline"
                >
                  {b.name}
                </Link>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-500">
                  {(b.city || b.postal_code) && (
                    <span>{[b.postal_code, b.city].filter(Boolean).join(" ")}</span>
                  )}
                  {(b.primary_email ?? b.email) && (
                    <span>{b.primary_email ?? b.email}</span>
                  )}
                  {b.phone && <span>{b.phone}</span>}
                </div>
              </div>
              <Link
                href={`/iml/customers/${b.id}?tab=shipping`}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
              >
                <MapPin className="h-3.5 w-3.5" />
                Doručovací adresy
                {(b.shipping_addresses_count ?? 0) > 0 && (
                  <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium">
                    {b.shipping_addresses_count}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">
          Zatím žádné pobočky.{" "}
          {canWrite && (
            <Link href={editHref} className="text-red-700 hover:underline">
              Přidat ve formuláři úprav
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
