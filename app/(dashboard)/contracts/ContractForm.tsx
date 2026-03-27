"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, FileUp, Loader2 } from "lucide-react";

type ContractTypeOption = {
  id: number;
  name: string;
  code: string | null;
};

type InitialContract = {
  title: string;
  contract_number: string | null;
  party_company: string | null;
  party_contact: string | null;
  contract_type_id: number;
  description: string | null;
  value_amount: string | null;
  value_currency: string | null;
  effective_from: string | null;
  valid_until: string | null;
  expires_at: string | null;
  responsible_user_id: number | null;
  department_id: number | null;
};

type Props = {
  mode: "create" | "edit";
  contractId?: number;
  initial?: InitialContract;
};

export function ContractForm({ mode, contractId, initial }: Props) {
  const router = useRouter();
  const [types, setTypes] = useState<ContractTypeOption[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [extractLoading, setExtractLoading] = useState(false);
  const [extractInfo, setExtractInfo] = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [contractTypeId, setContractTypeId] = useState<string>(
    initial?.contract_type_id ? String(initial.contract_type_id) : ""
  );
  const [contractNumber, setContractNumber] = useState(initial?.contract_number ?? "");
  const [partyCompany, setPartyCompany] = useState(initial?.party_company ?? "");
  const [partyContact, setPartyContact] = useState(initial?.party_contact ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [valueAmount, setValueAmount] = useState(
    initial?.value_amount != null ? String(initial.value_amount) : ""
  );
  const [valueCurrency, setValueCurrency] = useState(initial?.value_currency ?? "CZK");
  const [effectiveFrom, setEffectiveFrom] = useState(
    initial?.effective_from ? initial.effective_from.slice(0, 10) : ""
  );
  const [validUntil, setValidUntil] = useState(
    initial?.valid_until ? initial.valid_until.slice(0, 10) : ""
  );
  const [expiresAt, setExpiresAt] = useState(
    initial?.expires_at ? initial.expires_at.slice(0, 10) : ""
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/contract-types");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Chyba načtení typů");
        const list = (data.contract_types ?? []) as Array<{
          id: number;
          name: string;
          code: string | null;
        }>;
        if (!cancelled) setTypes(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Chyba");
      } finally {
        if (!cancelled) setLoadingTypes(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleExtractFromPdf() {
    const input = pdfInputRef.current;
    const file = input?.files?.[0];
    if (!file) {
      setError("Vyberte soubor PDF.");
      return;
    }
    setError("");
    setExtractInfo(null);
    setExtractLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/contracts/extract-from-pdf", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const hint = typeof data.hint === "string" ? ` ${data.hint}` : "";
        throw new Error(
          (typeof data.error === "string" ? data.error : "Vytěžení selhalo.") + hint
        );
      }
      const ex = data.extracted as {
        title?: string | null;
        contract_number?: string | null;
        party_company?: string | null;
        party_contact?: string | null;
        description?: string | null;
        value_amount?: string | null;
        value_currency?: string | null;
        effective_from?: string | null;
        valid_until?: string | null;
        expires_at?: string | null;
        contract_type_id?: number | null;
        notes?: string | null;
      };
      if (ex.title) setTitle(ex.title);
      if (ex.contract_number != null) setContractNumber(ex.contract_number);
      if (ex.party_company != null) setPartyCompany(ex.party_company);
      if (ex.party_contact != null) setPartyContact(ex.party_contact);
      if (ex.description != null) setDescription(ex.description);
      if (ex.value_amount != null) setValueAmount(ex.value_amount);
      if (ex.value_currency != null && ex.value_currency.trim())
        setValueCurrency(ex.value_currency.trim());
      if (ex.effective_from) setEffectiveFrom(ex.effective_from.slice(0, 10));
      if (ex.valid_until) setValidUntil(ex.valid_until.slice(0, 10));
      if (ex.expires_at) setExpiresAt(ex.expires_at.slice(0, 10));
      if (ex.contract_type_id != null) setContractTypeId(String(ex.contract_type_id));

      const meta = data.meta as { pageCount?: number; textLength?: number } | undefined;
      const parts = [
        "Pole formuláře byla doplněna návrhem z AI – zkontrolujte je před uložením (zejména typ smlouvy a částky).",
        meta?.pageCount != null ? `Stran PDF: ${meta.pageCount}.` : null,
        meta?.textLength != null ? `Délka textu: ${meta.textLength} znaků.` : null,
        ex.notes ? `Poznámka k obsahu: ${ex.notes}` : null,
      ].filter(Boolean);
      setExtractInfo(parts.join(" "));
      if (input) input.value = "";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba při vytěžování.");
    } finally {
      setExtractLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim()) {
      setError("Vyplňte název smlouvy.");
      return;
    }
    if (!contractTypeId) {
      setError("Vyberte typ smlouvy.");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        contract_type_id: parseInt(contractTypeId, 10),
        contract_number: contractNumber.trim() || null,
        party_company: partyCompany.trim() || null,
        party_contact: partyContact.trim() || null,
        description: description.trim() || null,
        value_currency: valueCurrency.trim() || "CZK",
        value_amount: valueAmount.trim() === "" ? null : valueAmount.trim(),
        effective_from: effectiveFrom || null,
        valid_until: validUntil || null,
        expires_at: expiresAt || null,
      };

      const url = mode === "create" ? "/api/contracts" : `/api/contracts/${contractId}`;
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Uložení se nezdařilo");
      }
      const id = mode === "create" ? data.contract?.id : contractId;
      router.push(`/contracts/${id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-4">
        <Button type="button" variant="ghost" size="icon" asChild>
          <Link href={mode === "create" ? "/contracts" : `/contracts/${contractId}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">
          {mode === "create" ? "Nová smlouva" : "Upravit smlouvu"}
        </h1>
      </div>

      {error && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {error}
        </div>
      )}

      {mode === "create" && (
        <div
          className="space-y-3 rounded-xl border border-dashed bg-muted/30 p-4 shadow-sm"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <FileUp className="h-5 w-5 shrink-0 text-muted-foreground" />
            <h2 className="text-base font-medium">Návrh z PDF (AI)</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Nahrajte textové PDF smlouvy. Lokálně zdarma:{" "}
            <a
              href="https://ollama.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Ollama
            </a>{" "}
            + model (např. llama3.2), případně nastavte OpenAI-kompatibilní API v prostředí. U skenů bez
            textové vrstvy použijte nejdříve OCR mimo aplikaci.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="max-w-full text-sm file:mr-2 file:rounded-md file:border file:bg-background file:px-2 file:py-1"
            />
            <Button
              type="button"
              variant="secondary"
              disabled={extractLoading || loadingTypes}
              onClick={handleExtractFromPdf}
            >
              {extractLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Vytěžuji…
                </>
              ) : (
                "Vytěžit a doplnit návrh"
              )}
            </Button>
          </div>
          {extractInfo && (
            <div
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
              role="status"
            >
              {extractInfo}
            </div>
          )}
        </div>
      )}

      <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm" style={{ borderColor: "var(--border)" }}>
        <div className="space-y-2">
          <Label htmlFor="title">Název smlouvy *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={500}
          />
        </div>

        <div className="space-y-2">
          <Label>Typ smlouvy *</Label>
          {loadingTypes ? (
            <p className="text-sm text-muted-foreground">Načítání typů…</p>
          ) : types.length === 0 ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              V databázi nejsou žádné typy smlouvy. Doplňte je v administraci (tabulka contract_types).
            </p>
          ) : (
            <Select
              value={contractTypeId || undefined}
              onValueChange={setContractTypeId}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Vyberte typ" />
              </SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name}
                    {t.code ? ` (${t.code})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="contract_number">Číslo / ID smlouvy</Label>
          <Input
            id="contract_number"
            value={contractNumber}
            onChange={(e) => setContractNumber(e.target.value)}
            maxLength={100}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="party_company">Strana – firma</Label>
            <Input
              id="party_company"
              value={partyCompany}
              onChange={(e) => setPartyCompany(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="party_contact">Strana – kontakt</Label>
            <Input
              id="party_contact"
              value={partyContact}
              onChange={(e) => setPartyContact(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Popis / anotace</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="value_amount">Hodnota</Label>
            <Input
              id="value_amount"
              type="text"
              inputMode="decimal"
              value={valueAmount}
              onChange={(e) => setValueAmount(e.target.value)}
              placeholder="např. 100000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="value_currency">Měna</Label>
            <Input
              id="value_currency"
              value={valueCurrency}
              onChange={(e) => setValueCurrency(e.target.value)}
              maxLength={10}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="effective_from">Účinnost od</Label>
            <Input
              id="effective_from"
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="valid_until">Platnost do</Label>
            <Input
              id="valid_until"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expires_at">Expirace</Label>
            <Input
              id="expires_at"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" asChild>
          <Link href={mode === "create" ? "/contracts" : `/contracts/${contractId}`}>Zrušit</Link>
        </Button>
        <Button type="submit" disabled={saving || loadingTypes || types.length === 0}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Ukládám…
            </>
          ) : (
            "Uložit"
          )}
        </Button>
      </div>
    </form>
  );
}
