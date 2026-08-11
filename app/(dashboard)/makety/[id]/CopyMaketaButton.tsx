"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy } from "lucide-react";

type Props = {
  id: number;
  /** kompaktní odkaz v tabulce vs. tlačítko na detailu */
  variant?: "button" | "link";
};

export function CopyMaketaButton({ id, variant = "button" }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onCopy = async () => {
    if (
      !confirm(
        "Vytvořit kopii této zakázky? Soubory a komentáře se nezkopírují — otevře se úprava nové zakázky."
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/makety/${id}/copy`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof data.error === "string" ? data.error : "Kopírování se nezdařilo");
        setLoading(false);
        return;
      }
      const newId = data.id as number | undefined;
      if (newId) {
        router.push(`/makety/${newId}/edit?copied=1`);
        router.refresh();
      } else {
        alert("Kopie vznikla, ale chybí ID — obnovte přehled.");
        router.push("/makety");
      }
    } catch {
      alert("Síťová chyba");
      setLoading(false);
    }
  };

  if (variant === "link") {
    return (
      <button
        type="button"
        onClick={onCopy}
        disabled={loading}
        className="text-sm font-medium text-violet-600 hover:underline disabled:opacity-50"
      >
        {loading ? "Kopíruji…" : "Kopírovat"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-lg border border-violet-300 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50"
    >
      <Copy className="h-4 w-4" />
      {loading ? "Kopíruji…" : "Kopírovat"}
    </button>
  );
}
