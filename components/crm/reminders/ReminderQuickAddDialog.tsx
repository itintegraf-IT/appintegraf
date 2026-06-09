"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { DatePicker } from "@/components/crm/DatePicker";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { REMINDER_TYPES, REMINDER_TYPE_LABEL, type ReminderType } from "@/lib/crm/reminder";

type Parent = {
  type: "COMPANY" | "DEAL";
  id: string;
  name: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parent: Parent;
};

const DEFAULT_DATE = () => format(addDays(new Date(), 1), "yyyy-MM-dd");
const DEFAULT_TYPE: ReminderType = "REMINDER";

export function ReminderQuickAddDialog({ open, onOpenChange, parent }: Props) {
  const router = useRouter();
  const [date, setDate] = useState<string>(DEFAULT_DATE());
  const [type, setType] = useState<ReminderType>(DEFAULT_TYPE);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!date) {
      toast.error("Vyber datum.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/crm/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parent_type: parent.type,
          parent_id: parent.id,
          type,
          date: new Date(date).toISOString(),
          note: note.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(j.error ?? "Nepodařilo se uložit připomenutí.");
        return;
      }
      toast.success("Připomenutí uloženo");
      onOpenChange(false);
      setDate(DEFAULT_DATE());
      setType(DEFAULT_TYPE);
      setNote("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title={`Připomenout se — ${parent.name}`}>
      <div className="flex flex-col gap-5 pt-2">
        <div className="flex flex-col gap-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Datum</Label>
          <DatePicker value={date} onChange={setDate} />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Typ</Label>
          <RadioGroup
            value={type}
            onValueChange={(v) => setType(v as ReminderType)}
            className="flex flex-col gap-2"
          >
            {REMINDER_TYPES.map((t) => (
              <Label key={t} className="flex items-center gap-2 font-normal cursor-pointer">
                <RadioGroupItem value={t} />
                <span>{REMINDER_TYPE_LABEL[t]}</span>
              </Label>
            ))}
          </RadioGroup>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="reminder-note" className="text-xs uppercase tracking-wider text-muted-foreground">
            Poznámka
          </Label>
          <Textarea
            id="reminder-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="např. zavolat ohledně IML smlouvy"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Zrušit
          </Button>
          <Button type="button" onClick={submit} disabled={submitting}>
            {submitting ? "Ukládám…" : "Uložit"}
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
