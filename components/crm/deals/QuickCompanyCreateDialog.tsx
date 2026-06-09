"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

export type CreatedCompany = { id: string; name: string };

export function QuickCompanyCreateDialog({
  open,
  onOpenChange,
  onCreate,
  defaultName = "",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (company: CreatedCompany) => void;
  defaultName?: string;
}) {
  const [name, setName] = useState(defaultName);
  const [ico, setIco] = useState("");
  const [loadingAres, setLoadingAres] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setName(defaultName);
  }, [open, defaultName]);

  const icoValid = /^\d{8}$/.test(ico);

  async function lookupAres() {
    if (!icoValid) return;
    setLoadingAres(true);
    try {
      const res = await fetch(`/api/ares/${ico}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error ?? "ARES lookup selhal");
        return;
      }
      const data = (await res.json()) as { name?: string };
      if (data.name) setName(data.name);
    } catch {
      toast.error("ARES nedostupný");
    } finally {
      setLoadingAres(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Název je povinný");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/crm/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), ico: ico || undefined }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error ?? "Nepodařilo se vytvořit firmu");
        return;
      }
      const created = (await res.json()) as CreatedCompany;
      onCreate(created);
      onOpenChange(false);
      setName("");
      setIco("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title="Nová firma">
      <form onSubmit={submit} className="flex flex-col gap-4 pt-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="qc-name">Jméno nebo název klienta</Label>
          <Input id="qc-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="qc-ico">IČO</Label>
          <div className="flex gap-2">
            <Input
              id="qc-ico"
              inputMode="numeric"
              maxLength={8}
              value={ico}
              onChange={(e) => setIco(e.target.value.replace(/\D/g, ""))}
            />
            <Button
              type="button"
              variant="outline"
              onClick={lookupAres}
              disabled={!icoValid || loadingAres}
            >
              <Search className="mr-1 size-4" />
              {loadingAres ? "Hledám…" : "ARES"}
            </Button>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Zrušit
          </Button>
          <Button type="submit" disabled={submitting || !name.trim()}>
            {submitting ? "Ukládám…" : "Uložit"}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
