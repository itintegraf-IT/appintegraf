"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CompanyPicker } from "@/components/crm/pickers/CompanyPicker";

const FormSchema = z.object({
  first_name: z.string().min(1, "Jméno je povinné"),
  last_name: z.string().min(1, "Příjmení je povinné"),
  role: z.string().optional(),
  email: z.string().email("Neplatný e-mail").optional().or(z.literal("")),
  phone: z.string().optional(),
});
type FormData = z.infer<typeof FormSchema>;

export function ContactForm({
  id,
  initial,
}: {
  id?: string;
  initial?: Partial<FormData> & { company_id?: string; is_decision_maker?: boolean };
}) {
  const router = useRouter();
  const [company_id, setCompanyId] = useState<string | null>(initial?.company_id ?? null);
  const [isDM, setIsDM] = useState(initial?.is_decision_maker ?? false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(FormSchema),
    mode: "onBlur",
    defaultValues: {
      first_name: initial?.first_name ?? "",
      last_name: initial?.last_name ?? "",
      role: initial?.role ?? "",
      email: initial?.email ?? "",
      phone: initial?.phone ?? "",
    },
  });

  async function onSubmit(data: FormData) {
    if (!company_id) {
      toast.error("Vyber firmu.");
      return;
    }
    setSubmitting(true);
    try {
      const url = id ? `/api/contacts/${id}` : "/api/crm/contacts";
      const method = id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, company_id, is_decision_maker: isDM }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Neznámá chyba");
      }
      const saved = (await res.json()) as { id?: string };
      toast.success(id ? "Kontakt uložen" : "Kontakt vytvořen");
      router.push(`/crm/contacts/${saved.id ?? id}`);
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
        <CompanyPicker value={company_id} onChange={(id) => setCompanyId(id)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>Jméno *</Label>
          <Input {...form.register("first_name")} aria-invalid={!!form.formState.errors.first_name} />
          {form.formState.errors.first_name ? (
            <p className="text-xs text-destructive">{form.formState.errors.first_name.message}</p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label>Příjmení *</Label>
          <Input {...form.register("last_name")} aria-invalid={!!form.formState.errors.last_name} />
          {form.formState.errors.last_name ? (
            <p className="text-xs text-destructive">{form.formState.errors.last_name.message}</p>
          ) : null}
        </div>
      </div>
      <div className="grid gap-2">
        <Label>Pozice / role</Label>
        <Input {...form.register("role")} placeholder="Jednatel / nákupčí / …" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>E-mail</Label>
          <Input type="email" {...form.register("email")} aria-invalid={!!form.formState.errors.email} />
          {form.formState.errors.email ? (
            <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label>Telefon</Label>
          <Input {...form.register("phone")} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="isDM" checked={isDM} onCheckedChange={(v) => setIsDM(v === true)} />
        <Label htmlFor="isDM" className="cursor-pointer">
          Decision maker
        </Label>
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
