"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { toast } from "sonner";
import { AresLookupButton } from "@/components/crm/AresLookupButton";
import { crmUserDisplayName } from "@/lib/crm/users";

const FormSchema = z.object({
  name: z.string().min(1, "Název je povinný"),
  ico: z.string().regex(/^\d{8}$/, "IČO musí mít 8 číslic").optional().or(z.literal("")),
  dic: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  segment: z.string().optional().or(z.literal("")),
});
type FormData = z.infer<typeof FormSchema>;

export function CompanyForm({
  initial,
  id,
  owners,
}: {
  initial?: Partial<FormData> & { owner_id?: number | null };
  id?: string;
  owners: { id: number; first_name: string; last_name: string; email: string }[];
}) {
  const router = useRouter();
  const [owner_id, setOwnerId] = useState<string>(
    initial?.owner_id != null ? String(initial.owner_id) : "",
  );
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(FormSchema),
    mode: "onBlur",
    defaultValues: {
      name: initial?.name ?? "",
      ico: initial?.ico ?? "",
      dic: initial?.dic ?? "",
      address: initial?.address ?? "",
      segment: initial?.segment ?? "",
    },
  });

  async function onSubmit(data: FormData) {
    setSubmitting(true);
    const url = id ? `/api/companies/${id}` : "/api/crm/companies";
    const method = id ? "PATCH" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, owner_id: owner_id ? Number(owner_id) : null }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Neznámá chyba");
      }
      const saved = (await res.json()) as { id?: string };
      toast.success(id ? "Firma uložena" : "Firma vytvořena");
      router.push(`/crm/companies/${saved.id ?? id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chyba při ukládání");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-2xl">
      <div className="grid gap-2">
        <Label>IČO</Label>
        <div className="flex gap-2">
          <Input {...form.register("ico")} placeholder="25242438" className="max-w-[200px]" aria-invalid={!!form.formState.errors.ico} />
          <AresLookupButton
            getIco={() => form.getValues("ico") ?? ""}
            onResult={(r) => {
              form.setValue("name", r.name);
              if (r.dic) form.setValue("dic", r.dic);
              if (r.address) form.setValue("address", r.address);
            }}
          />
        </div>
        {form.formState.errors.ico ? (
          <p className="text-xs text-destructive">{form.formState.errors.ico.message}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label>Název *</Label>
        <Input {...form.register("name")} aria-invalid={!!form.formState.errors.name} />
        {form.formState.errors.name ? (
          <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label>DIČ</Label>
        <Input {...form.register("dic")} />
      </div>

      <div className="grid gap-2">
        <Label>Adresa</Label>
        <Textarea {...form.register("address")} rows={2} />
      </div>

      <div className="grid gap-2">
        <Label>Segment</Label>
        <Input {...form.register("segment")} placeholder="IML / KA / Knihy / …" />
      </div>

      <div className="grid gap-2">
        <Label>Owner</Label>
        <Select value={owner_id || undefined} onValueChange={(v) => setOwnerId(v)}>
          <SelectTrigger>
            <SelectValue placeholder="(ponechat / nezadáno)" />
          </SelectTrigger>
          <SelectContent>
            {owners.map((o) => (
              <SelectItem key={o.id} value={String(o.id)}>{crmUserDisplayName(o)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Ukládám…" : id ? "Uložit" : "Vytvořit"}
        </Button>
        <Button type="button" variant="outline" onClick={() => { router.back(); }}>
          Zrušit
        </Button>
      </div>
    </form>
  );
}
