"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Building2, MapPin, Pencil, Plus } from "lucide-react";
import CustomerBranchModal from "./CustomerBranchModal";

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
  onBranchAdded?: () => void;
};

export default function CustomerBranchesPanel({
  headquartersId,
  unitType,
  branches: initialBranches,
  canWrite = true,
  onBranchAdded,
}: Props) {
  const [branches, setBranches] = useState<BranchListItem[]>(initialBranches);
  const [modalOpen, setModalOpen] = useState(false);
  const [editBranchId, setEditBranchId] = useState<number | null>(null);

  const canAddBranch = unitType === "standalone" || unitType === "headquarters";

  const loadBranches = useCallback(async () => {
    const res = await fetch(`/api/iml/customers/${headquartersId}/branches`);
    if (res.ok) {
      const data = await res.json();
      setBranches(data.branches ?? []);
    }
  }, [headquartersId]);

  useEffect(() => {
    setBranches(initialBranches);
  }, [initialBranches]);

  useEffect(() => {
    if (initialBranches.length === 0 && headquartersId) {
      loadBranches();
    }
  }, [headquartersId, initialBranches.length, loadBranches]);

  const openCreate = () => {
    setEditBranchId(null);
    setModalOpen(true);
  };

  const openEdit = (id: number) => {
    setEditBranchId(id);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditBranchId(null);
  };

  const handleSaved = () => {
    loadBranches();
    onBranchAdded?.();
  };

  if (!canAddBranch && branches.length === 0) return null;

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Pobočky skupiny</h2>
          </div>
          {canWrite && canAddBranch && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
            >
              <Plus className="h-4 w-4" />
              Přidat pobočku
            </button>
          )}
        </div>

        <p className="mb-4 text-sm text-gray-500">
          Doručovací adresy spravujte u každé jednotky zvlášť (centrála má vlastní záložku
          Doručovací adresy, pobočka zde nebo v jejím detailu).
        </p>

        {unitType === "standalone" && branches.length === 0 && (
          <p className="mb-4 text-sm text-gray-500">
            Samostatný zákazník – po přidání první pobočky se stane centrálou skupiny.
          </p>
        )}

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
                      <span>
                        {[b.postal_code, b.city].filter(Boolean).join(" ")}
                      </span>
                    )}
                    {(b.primary_email ?? b.email) && (
                      <span>{b.primary_email ?? b.email}</span>
                    )}
                    {b.phone && <span>{b.phone}</span>}
                    {b.contact_person && <span>{b.contact_person}</span>}
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
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
                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => openEdit(b.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Upravit
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Zatím žádné pobočky.</p>
        )}
      </div>

      <CustomerBranchModal
        open={modalOpen}
        onClose={handleModalClose}
        headquartersId={headquartersId}
        branchId={editBranchId}
        mode={editBranchId != null ? "edit" : "create"}
        onSaved={handleSaved}
      />
    </>
  );
}
