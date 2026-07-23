"use client";

import { useState } from "react";
import { Button } from "@/components/projekty/ui/button";
import { TiptapEditor } from "@/components/projekty/editor/TiptapEditor";

export function CardDescriptionEditor({
  value,
  onSave,
  cardId,
}: {
  value: string;
  onSave: (newValue: string) => void | Promise<void>;
  cardId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    await onSave(draft);
    setBusy(false);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className="block w-full rounded bg-muted/40 p-3 text-left text-sm hover:bg-muted/60"
      >
        {value ? (
          <div
            className="text-sm [&_p]:my-1 [&_ul]:ml-4 [&_ul]:list-disc [&_ol]:ml-4 [&_ol]:list-decimal [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1"
            dangerouslySetInnerHTML={{ __html: value }}
          />
        ) : (
          <span className="text-muted-foreground">Přidej popis…</span>
        )}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <TiptapEditor value={draft} onChange={setDraft} placeholder="Popis karty…" variant="rich" cardId={cardId} />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => void handleSave()} disabled={busy}>
          {busy ? "Ukládám…" : "Uložit"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditing(false);
            setDraft(value);
          }}
        >
          Zrušit
        </Button>
      </div>
    </div>
  );
}
