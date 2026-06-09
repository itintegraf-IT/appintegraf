"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import type { crm_deal_stage } from "@prisma/client";

import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CompanyPicker } from "@/components/crm/pickers/CompanyPicker";
import { ContactPicker } from "@/components/crm/pickers/ContactPicker";
import { StageProgressPicker } from "@/components/crm/deals/StageProgressPicker";
import { CategoryPicker, type CategoryOption } from "@/components/crm/deals/CategoryPicker";
import { QuickCompanyCreateDialog } from "@/components/crm/deals/QuickCompanyCreateDialog";
import { STAGE_DEFAULT_PROBABILITY } from "@/lib/crm/deal-stages";
import { formatMoneyInput, moneyInputToNumber, parseMoneyInput } from "@/lib/crm/format-money";

export type CreatedDeal = { id: string; number: string; stage: crm_deal_stage; title: string };

type PreselectedCompany = { id: string; name: string };

export function DealQuickAddDialog({
  open,
  onOpenChange,
  categories,
  lost_reasons,
  defaultStage = "LEAD",
  preselectedCompany,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: CategoryOption[];
  lost_reasons: { code: string; label: string }[];
  defaultStage?: crm_deal_stage;
  preselectedCompany?: PreselectedCompany;
  onCreated: (deal: CreatedDeal) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [stage, setStage] = useState<crm_deal_stage>(defaultStage);
  const [probability, setProbability] = useState(STAGE_DEFAULT_PROBABILITY[defaultStage]);
  const [category_id, setCategoryId] = useState<string | null>(null);
  const [company_id, setCompanyId] = useState<string | null>(preselectedCompany?.id ?? null);
  const [contactIds, setContactIds] = useState<string[]>([]);
  const [lost_reason, setLostReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [quickCompanyOpen, setQuickCompanyOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setValue("");
    setStage(defaultStage);
    setProbability(STAGE_DEFAULT_PROBABILITY[defaultStage]);
    setCategoryId(null);
    setCompanyId(preselectedCompany?.id ?? null);
    setContactIds([]);
    setLostReason("");
  }, [open, defaultStage, preselectedCompany?.id]);

  function changeStage(next: crm_deal_stage) {
    setStage(next);
    setProbability(STAGE_DEFAULT_PROBABILITY[next]);
    if (next !== "LOST") setLostReason("");
  }

  async function submit(openAfter: boolean) {
    if (!title.trim()) {
      toast.error("Název je povinný");
      return;
    }
    if (!company_id) {
      toast.error("Vyber nebo vytvoř firmu");
      return;
    }
    if (stage === "LOST" && !lost_reason) {
      toast.error("Vyber důvod prohry");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/crm/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id,
          title: title.trim(),
          value: moneyInputToNumber(value),
          stage,
          probability,
          category_id,
          contactIds,
          lost_reason: stage === "LOST" ? lost_reason : undefined,
          close_date: stage === "WON" ? new Date().toISOString() : undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error ?? "Nepodařilo se vytvořit deal");
        return;
      }
      const created = (await res.json()) as { id: string; number: string };
      onCreated({ id: created.id, number: created.number, stage, title: title.trim() });
      onOpenChange(false);
      toast.success("Deal vytvořen");
      if (openAfter) router.push(`/crm/deals/${created.id}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <ResponsiveDialog open={open} onOpenChange={onOpenChange} title="Nový obchodní případ">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          className="flex flex-col gap-5 pt-2"
        >
            <div className="flex flex-col gap-2">
              <Label htmlFor="qa-title" className="text-xs uppercase tracking-wider text-muted-foreground">
                Název
              </Label>
              <Input
                id="qa-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Např. IML etikety pro Alimpex 2026"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Konečná cena</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={formatMoneyInput(value)}
                  onChange={(e) => setValue(parseMoneyInput(e.target.value))}
                  placeholder="0"
                  className="text-lg"
                />
                <span className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">Kč</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Stav</Label>
              <StageProgressPicker value={stage} onChange={changeStage} />
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Pravděpodobnost — {probability}%
              </Label>
              <Slider
                value={[probability]}
                onValueChange={([v]) => setProbability(v ?? 0)}
                min={0}
                max={100}
                step={5}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Kategorie</Label>
              <CategoryPicker categories={categories} value={category_id} onChange={setCategoryId} />
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Čeho se to týká</Label>
              <div className="flex flex-col gap-2">
                <CompanyPicker
                  value={company_id}
                  onChange={(id) => {
                    setCompanyId(id);
                    setContactIds([]);
                  }}
                />
                <button
                  type="button"
                  onClick={() => setQuickCompanyOpen(true)}
                  className="self-start text-sm text-success hover:underline"
                >
                  + Přidat nového klienta
                </button>
              </div>
            </div>

            {company_id ? (
              <div className="flex flex-col gap-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Kontaktní osoba
                </Label>
                <ContactPicker company_id={company_id} value={contactIds} onChange={setContactIds} />
              </div>
            ) : null}

            {stage === "LOST" ? (
              <div className="flex flex-col gap-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Důvod prohry *
                </Label>
                <Select value={lost_reason || undefined} onValueChange={setLostReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vyber důvod" />
                  </SelectTrigger>
                  <SelectContent>
                    {lost_reasons.map((r) => (
                      <SelectItem key={r.code} value={r.code}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="default"
                className="bg-success text-success-foreground hover:bg-success/90"
                disabled={submitting}
                onClick={() => submit(true)}
              >
                Uložit & otevřít
              </Button>
              <Button type="button" disabled={submitting} onClick={() => submit(false)}>
                {submitting ? "Ukládám…" : "Uložit"}
              </Button>
            </div>
        </motion.div>
      </ResponsiveDialog>

      <QuickCompanyCreateDialog
        open={quickCompanyOpen}
        onOpenChange={setQuickCompanyOpen}
        onCreate={(c) => setCompanyId(c.id)}
      />
    </>
  );
}
