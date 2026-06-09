"use client";

import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { crm_deal_stage } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CompanyPicker } from "@/components/crm/pickers/CompanyPicker";
import { ContactPicker } from "@/components/crm/pickers/ContactPicker";
import { DatePicker } from "@/components/crm/DatePicker";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/crm/deal-stages";
import type { CategoryOption } from "@/components/crm/deals/CategoryPicker";
import { CategoryPicker } from "@/components/crm/deals/CategoryPicker";
import { formatMoneyInput, parseMoneyInput } from "@/lib/crm/format-money";

const FormSchema = z.object({
  title: z.string().min(1),
  value: z.coerce.number().min(0),
  stage: z.nativeEnum(crm_deal_stage),
  probability: z.coerce.number().int().min(0).max(100),
  close_date: z.string().optional().or(z.literal("")),
  lost_reason: z.string().optional().or(z.literal("")),
  category_id: z.string().optional().nullable(),
});
type FormData = z.infer<typeof FormSchema>;

export function DealForm({
  id,
  initial,
  owners,
  lost_reasons,
  categories,
}: {
  id?: string;
  initial?: Partial<FormData> & {
    company_id?: string;
    owner_id?: number | string;
    contactIds?: string[];
    category_id?: string | null;
  };
  owners: { id: number; name: string | null; email: string | null }[];
  lost_reasons: { code: string; label: string }[];
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [company_id, setCompanyId] = useState<string | null>(initial?.company_id ?? null);
  const [owner_id, setOwnerId] = useState<string>(
    initial?.owner_id != null ? String(initial.owner_id) : "",
  );
  const [contactIds, setContactIds] = useState<string[]>(initial?.contactIds ?? []);
  const [category_id, setCategoryId] = useState<string | null>(initial?.category_id ?? null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(FormSchema) as Resolver<FormData>,
    mode: "onBlur",
    defaultValues: {
      title: initial?.title ?? "",
      value: initial?.value ?? ("" as unknown as number),
      stage: initial?.stage ?? "LEAD",
      probability: initial?.probability ?? 10,
      close_date: initial?.close_date ?? "",
      lost_reason: initial?.lost_reason ?? "",
    },
  });
  const currentStage = form.watch("stage");

  async function onSubmit(data: FormData) {
    if (!company_id) { toast.error("Vyber firmu."); return; }
    setSubmitting(true);
    try {
      const url = id ? `/api/deals/${id}` : "/api/crm/deals";
      const method = id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          company_id,
          owner_id: owner_id ? Number(owner_id) : undefined,
          contactIds,
          category_id,
          close_date: data.close_date ? new Date(data.close_date).toISOString() : undefined,
          lost_reason: data.stage === "LOST" ? data.lost_reason : undefined,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Neznámá chyba");
      }
      const saved = (await res.json()) as { id?: string };
      toast.success(id ? "Deal uložen" : "Deal vytvořen");
      router.push(`/crm/deals/${saved.id ?? id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chyba");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-2xl">
      <div className="grid gap-2">
        <Label>Firma *</Label>
        <CompanyPicker
          value={company_id}
          onChange={(id) => { setCompanyId(id); setContactIds([]); }}
        />
      </div>
      <div className="grid gap-2">
        <Label>Název dealu *</Label>
        <Input
          {...form.register("title")}
          placeholder="IML etikety pro Alimpex 2026"
          aria-invalid={!!form.formState.errors.title}
        />
        {form.formState.errors.title ? (
          <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>Hodnota (Kč) *</Label>
          <Controller
            control={form.control}
            name="value"
            render={({ field }) => {
              const raw = field.value === undefined || field.value === null ? "" : String(field.value).replace(".", ",");
              return (
                <Input
                  type="text"
                  inputMode="decimal"
                  value={formatMoneyInput(raw)}
                  onChange={(e) => {
                    const cleaned = parseMoneyInput(e.target.value);
                    field.onChange(cleaned === "" ? "" : cleaned.replace(",", "."));
                  }}
                  onBlur={field.onBlur}
                  aria-invalid={!!form.formState.errors.value}
                />
              );
            }}
          />
          {form.formState.errors.value ? (
            <p className="text-xs text-destructive">{String(form.formState.errors.value.message ?? "")}</p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label>Pravděpodobnost (%) *</Label>
          <Input
            type="number"
            min="0"
            max="100"
            {...form.register("probability")}
            aria-invalid={!!form.formState.errors.probability}
          />
          {form.formState.errors.probability ? (
            <p className="text-xs text-destructive">{String(form.formState.errors.probability.message ?? "")}</p>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>Stage *</Label>
          <Controller
            control={form.control}
            name="stage"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Vyber fázi" />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="grid gap-2">
          <Label>Close date</Label>
          <DatePicker
            value={form.watch("close_date") ?? ""}
            onChange={(v) => form.setValue("close_date", v, { shouldDirty: true })}
          />
        </div>
      </div>
      {currentStage === "LOST" ? (
        <div className="grid gap-2">
          <Label>Důvod prohry</Label>
          <Controller
            control={form.control}
            name="lost_reason"
            render={({ field }) => (
              <Select value={field.value || undefined} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="(vyber)" />
                </SelectTrigger>
                <SelectContent>
                  {lost_reasons.map((r) => (
                    <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      ) : null}
      <div className="grid gap-2">
        <Label>Owner</Label>
        <Select value={owner_id || undefined} onValueChange={setOwnerId}>
          <SelectTrigger>
            <SelectValue placeholder="(aktuální uživatel)" />
          </SelectTrigger>
          <SelectContent>
            {owners.map((o) => (
              <SelectItem key={o.id} value={String(o.id)}>{o.name ?? o.email ?? o.id}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label>Kontakty na firmě</Label>
        <ContactPicker company_id={company_id} value={contactIds} onChange={setContactIds} />
      </div>
      <div className="grid gap-2">
        <Label>Kategorie</Label>
        <CategoryPicker categories={categories} value={category_id} onChange={setCategoryId} />
      </div>
      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Ukládám…" : id ? "Uložit" : "Vytvořit"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Zrušit
        </Button>
      </div>
    </form>
  );
}
