"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function AresLookupButton({
  getIco,
  onResult,
}: {
  getIco: () => string;
  onResult: (r: { name: string; dic: string | null; address: string | null }) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function lookup() {
    const ico = getIco().trim();
    if (!/^\d{8}$/.test(ico)) {
      toast.error("Zadej platné IČO (8 číslic) před lookup.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/ares/${ico}`);
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `ARES vrátil ${res.status}`);
      }
      const data = (await res.json()) as { name: string; dic: string | null; address: string | null };
      onResult({ name: data.name, dic: data.dic, address: data.address });
      toast.success("Data z ARESu doplněna.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ARES lookup selhal");
    } finally {
      setLoading(false);
    }
  }

  function handleClick() {
    void lookup();
  }

  return (
    <Button type="button" variant="secondary" onClick={handleClick} disabled={loading}>
      {loading ? "Hledám…" : "Doplnit z ARES"}
    </Button>
  );
}
