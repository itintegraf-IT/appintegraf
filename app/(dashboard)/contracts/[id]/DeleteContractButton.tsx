"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";

export function DeleteContractButton({ contractId }: { contractId: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Opravdu smazat tuto smlouvu? Akce je nevratná.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Smazání se nezdařilo");
      router.push("/contracts");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Chyba");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      onClick={handleDelete}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <Trash2 className="mr-2 h-4 w-4" />
          Smazat návrh
        </>
      )}
    </Button>
  );
}
