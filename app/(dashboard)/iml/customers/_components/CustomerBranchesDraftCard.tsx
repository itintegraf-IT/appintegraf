"use client";

import { useEffect, useState } from "react";
import { Building2, ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import CustomerFormSections, {
  type CustomerFormErrors,
  type CustomerFormState,
} from "./CustomerFormSections";
import CustomerEmailsEditor, { type CustomerEmailRow } from "./CustomerEmailsEditor";
import CustomerContactsEditor, { type CustomerContactRow } from "./CustomerContactsEditor";
import CustomerShippingAddressesDraft from "./CustomerShippingAddressesDraft";
import {
  validateBranchForm,
  validateCustomerField,
} from "./customerValidation";
import {
  type DraftBranch,
  emptyDraftBranch,
  validateDraftShippingList,
} from "@/lib/iml-customer-form-draft";

type Props = {
  branches: DraftBranch[];
  onChange: (branches: DraftBranch[]) => void;
  viewMode: "tabs" | "sections";
  /** Chyby z validace při odeslání hlavního formuláře */
  externalFieldErrors?: Record<string, CustomerFormErrors>;
  externalShippingErrors?: Record<string, string>;
};

export default function CustomerBranchesDraftCard({
  branches,
  onChange,
  viewMode,
  externalFieldErrors,
  externalShippingErrors,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [branchErrors, setBranchErrors] = useState<Record<string, CustomerFormErrors>>({});

  useEffect(() => {
    const ids = new Set([
      ...Object.keys(externalFieldErrors ?? {}),
      ...Object.keys(externalShippingErrors ?? {}),
    ]);
    if (ids.size === 0) return;
    setExpanded((prev) => new Set([...prev, ...ids]));
  }, [externalFieldErrors, externalShippingErrors]);

  const toggleExpanded = (tempId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(tempId)) next.delete(tempId);
      else next.add(tempId);
      return next;
    });
  };

  const addBranch = () => {
    const b = emptyDraftBranch();
    onChange([...branches, b]);
    setExpanded((prev) => new Set(prev).add(b.tempId));
  };

  const removeBranch = (tempId: string) => {
    const b = branches.find((x) => x.tempId === tempId);
    if (!b) return;
    if (!confirm(`Odebrat pobočku „${b.name || "bez názvu"}" z formuláře?`)) return;
    onChange(branches.filter((x) => x.tempId !== tempId));
    setBranchErrors((prev) => {
      const next = { ...prev };
      delete next[tempId];
      return next;
    });
  };

  const updateBranch = (tempId: string, patch: Partial<DraftBranch>) => {
    onChange(branches.map((b) => (b.tempId === tempId ? { ...b, ...patch } : b)));
  };

  const setBranchField = <K extends keyof CustomerFormState>(
    tempId: string,
    k: K,
    v: CustomerFormState[K]
  ) => {
    const branch = branches.find((b) => b.tempId === tempId);
    if (!branch) return;
    updateBranch(tempId, { [k]: v } as Partial<DraftBranch>);
    if (branchErrors[tempId]?.[k]) {
      setBranchErrors((prev) => {
        const next = { ...prev };
        const be = { ...next[tempId] };
        delete be[k];
        next[tempId] = be;
        return next;
      });
    }
  };

  const handleBranchBlur = (tempId: string, field: keyof CustomerFormState) => {
    const branch = branches.find((b) => b.tempId === tempId);
    if (!branch) return;
    const err = validateCustomerField(field, branch);
    setBranchErrors((prev) => {
      const next = { ...prev };
      const be = { ...(next[tempId] ?? {}) };
      if (err) be[field] = err;
      else delete be[field];
      next[tempId] = be;
      return next;
    });
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Pobočky skupiny</h2>
        </div>
        <button
          type="button"
          onClick={addBranch}
          className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
        >
          <Plus className="h-4 w-4" />
          Přidat pobočku
        </button>
      </div>

      <p className="mb-4 text-sm text-gray-500">
        Každá pobočka má vlastní kontakty, fakturační údaje a doručovací adresy. Uloží se společně
        se zákazníkem jedním tlačítkem.
      </p>

      {branches.length === 0 ? (
        <p className="text-sm text-gray-500">Zatím žádná pobočka – přidejte první tlačítkem výše.</p>
      ) : (
        <ul className="space-y-3">
          {branches.map((branch, index) => {
            const isOpen = expanded.has(branch.tempId);
            const errs = {
              ...(externalFieldErrors?.[branch.tempId] ?? {}),
              ...branchErrors[branch.tempId],
            };
            const shippingErr =
              externalShippingErrors?.[branch.tempId] ??
              validateDraftShippingList(
                branch.shipping_addresses,
                `Pobočka „${branch.name || index + 1}“`
              );

            return (
              <li
                key={branch.tempId}
                className="rounded-lg border border-gray-200 bg-gray-50/50"
              >
                <div className="flex items-center gap-2 p-3">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(branch.tempId)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-500" />
                    )}
                    <span
                      className={`font-medium ${
                        Object.keys(errs).length > 0 || shippingErr
                          ? "text-red-700"
                          : "text-gray-900"
                      }`}
                    >
                      {branch.name.trim() || `Pobočka ${index + 1}`}
                    </span>
                    {(Object.keys(errs).length > 0 || shippingErr) && !isOpen && (
                      <span className="text-xs font-medium text-red-600">– vyžaduje opravu</span>
                    )}
                    {branch.city && (
                      <span className="truncate text-sm text-gray-500">{branch.city}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeBranch(branch.tempId)}
                    className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                    title="Odebrat pobočku"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {isOpen && (
                  <div className="space-y-4 border-t border-gray-200 bg-white p-4">
                    {Object.keys(errs).length > 0 && (
                      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        Opravte chyby v údajích pobočky.
                      </p>
                    )}
                    {shippingErr && (
                      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {shippingErr}
                      </p>
                    )}

                    <CustomerFormSections
                      form={branch}
                      setField={(k, v) => setBranchField(branch.tempId, k, v)}
                      mode={viewMode}
                      errors={errs}
                      onBlurField={(f) => handleBranchBlur(branch.tempId, f)}
                      branchMode
                      compact
                      nameLabel="Název pobočky *"
                      visibleSections={["identification", "billing"]}
                    />

                    <div className="rounded-lg border border-gray-100 p-4">
                      <h3 className="mb-3 text-sm font-semibold text-gray-800">E-maily pobočky</h3>
                      <CustomerEmailsEditor
                        rows={branch.emails}
                        onChange={(emails) => updateBranch(branch.tempId, { emails })}
                      />
                    </div>

                    <div className="rounded-lg border border-gray-100 p-4">
                      <h3 className="mb-3 text-sm font-semibold text-gray-800">Kontakty pobočky</h3>
                      <CustomerContactsEditor
                        rows={branch.contacts}
                        onChange={(contacts) => updateBranch(branch.tempId, { contacts })}
                      />
                    </div>

                    <CustomerShippingAddressesDraft
                      addresses={branch.shipping_addresses}
                      onChange={(shipping_addresses) =>
                        updateBranch(branch.tempId, { shipping_addresses })
                      }
                      title="Doručovací adresy pobočky"
                      embedded
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Export pro validaci z wizardu */
export function validateAllBranches(branches: DraftBranch[]): {
  ok: boolean;
  branchErrors: Record<string, CustomerFormErrors>;
  shippingErrors: Record<string, string>;
  message?: string;
} {
  const branchErrors: Record<string, CustomerFormErrors> = {};
  const shippingErrors: Record<string, string> = {};
  let message: string | undefined;

  for (const branch of branches) {
    const errs = validateBranchForm(branch);
    if (Object.keys(errs).length > 0) {
      branchErrors[branch.tempId] = errs;
      message = message ?? "Opravte chyby u poboček (rozbalte označené pobočky).";
    }
    const shipErr = validateDraftShippingList(
      branch.shipping_addresses,
      `Pobočka „${branch.name || "bez názvu"}“`
    );
    if (shipErr) {
      shippingErrors[branch.tempId] = shipErr;
      message = shipErr;
    }
  }

  return {
    ok: Object.keys(branchErrors).length === 0 && Object.keys(shippingErrors).length === 0,
    branchErrors,
    shippingErrors,
    message,
  };
}
