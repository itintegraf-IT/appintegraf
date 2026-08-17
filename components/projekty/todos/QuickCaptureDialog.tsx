"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/projekty/ui/dialog";

export function QuickCaptureDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  async function submit() {
    const title = value.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/projekty/personal-todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("API error");
      toast.success("Úkol přidán do Moje práce", {
        action: {
          label: "Otevřít",
          onClick: () => router.push("/projekty/moje-prace"),
        },
      });
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Úkol se nepodařilo přidat");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[20%] sm:max-w-md" showCloseButton={false}>
        <DialogTitle className="sr-only">Rychlé přidání úkolu</DialogTitle>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
          disabled={busy}
          placeholder="Nový úkol… (Enter pro uložení)"
          className="w-full bg-transparent text-base focus:outline-none"
        />
      </DialogContent>
    </Dialog>
  );
}
