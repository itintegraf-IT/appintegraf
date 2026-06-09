"use client";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateTimePicker } from "@/components/crm/DateTimePicker";
import { ACTIVITY_TYPES } from "@/lib/crm/validators/activity";
import { toDatetimeLocalInput } from "@/lib/crm/datetime-input";
import type { crm_parent_type, crm_activity_type } from "@prisma/client";

const TYPE_LABELS: Record<(typeof ACTIVITY_TYPES)[number], string> = {
  CALL: "Hovor",
  MEETING: "Schůzka",
  EMAIL: "Email",
  REMINDER: "Připomenutí",
  NOTE: "Poznámka",
};

const DURATION_OPTIONS: { value: string; label: string }[] = [
  { value: "5", label: "5 min" },
  { value: "10", label: "10 min" },
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "1 h" },
  { value: "90", label: "1,5 h" },
  { value: "120", label: "2 h" },
  { value: "180", label: "3 h" },
  { value: "240", label: "4 h" },
  { value: "480", label: "8 h" },
];

const FormSchema = z.object({
  type: z.enum(ACTIVITY_TYPES),
  date: z.string().min(1, "Datum je povinný"),
  duration: z.string().optional(),
  note: z.string().optional(),
  outcome: z.string().optional(),
  next_action_date: z.string().optional(),
  assignee_id: z.string().optional(),
});

type FormValues = z.infer<typeof FormSchema>;

export type ActivityFormMode =
  | { kind: "create"; parent_type: crm_parent_type; parent_id: string }
  | { kind: "edit"; activityId: string; activityType: crm_activity_type };

type Props = {
  mode: ActivityFormMode;
  initialValues?: Partial<FormValues>;
  users: { id: number; name: string | null; email: string | null }[];
  onSuccess?: () => void;
};

const EMAIL_LOCKED: Array<keyof FormValues> = ["type", "date", "note"];

export function ActivityForm({ mode, initialValues, users, onSuccess }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isEmailEdit = mode.kind === "edit" && mode.activityType === "EMAIL";

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    mode: "onBlur",
    defaultValues: {
      type: initialValues?.type ?? "CALL",
      date: initialValues?.date ?? toDatetimeLocalInput(new Date()),
      duration: initialValues?.duration ?? "",
      note: initialValues?.note ?? "",
      outcome: initialValues?.outcome ?? "",
      next_action_date: initialValues?.next_action_date ?? "",
      assignee_id: initialValues?.assignee_id ?? "",
    },
  });

  function isLocked(field: keyof FormValues): boolean {
    return isEmailEdit && EMAIL_LOCKED.includes(field);
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const payload = {
        type: values.type,
        date: new Date(values.date).toISOString(),
        duration: values.duration ? Number(values.duration) : null,
        note: values.note || null,
        outcome: values.outcome || null,
        next_action_date: values.next_action_date ? new Date(values.next_action_date).toISOString() : null,
        assignee_id: values.assignee_id || null,
      };
      const url = mode.kind === "create"
        ? "/api/crm/activities"
        : `/api/activities/${mode.activityId}`;
      const body = mode.kind === "create"
        ? { ...payload, parent_type: mode.parent_type, parent_id: mode.parent_id }
        : payload;

      const res = await fetch(url, {
        method: mode.kind === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Chyba při ukládání");
      }
      toast.success(mode.kind === "create" ? "Aktivita přidána" : "Aktivita upravena");
      if (mode.kind === "create") form.reset();
      router.refresh();
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chyba");
    } finally {
      setSubmitting(false);
    }
  }

  const lockedTooltip = "Email synchronizován z Outlooku — editovat lze jen výsledek a follow-up.";

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 rounded-lg border bg-card p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Typ</Label>
          <Controller
            control={form.control}
            name="type"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={isLocked("type")}
              >
                <SelectTrigger className="mt-1" title={isLocked("type") ? lockedTooltip : undefined}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div>
          <Label>Datum a čas</Label>
          <DateTimePicker
            value={form.watch("date") ?? ""}
            onChange={(v) => form.setValue("date", v, { shouldDirty: true, shouldValidate: true })}
            disabled={isLocked("date")}
          />
          {form.formState.errors.date ? (
            <p className="mt-1 text-xs text-destructive">{form.formState.errors.date.message}</p>
          ) : null}
        </div>
        <div>
          <Label>Délka trvání</Label>
          <Controller
            control={form.control}
            name="duration"
            render={({ field }) => (
              <Select
                value={field.value || undefined}
                onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="(neuvedeno)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">(neuvedeno)</SelectItem>
                  {DURATION_OPTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div>
          <Label>Assignee</Label>
          <Controller
            control={form.control}
            name="assignee_id"
            render={({ field }) => (
              <Select value={field.value || undefined} onValueChange={field.onChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="(nikdo)" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name ?? u.email ?? u.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="activity-note">Poznámka</Label>
        <Textarea id="activity-note" rows={3} {...form.register("note")} disabled={isLocked("note")} title={isLocked("note") ? lockedTooltip : undefined} />
      </div>
      <div>
        <Label>Výsledek</Label>
        <Textarea rows={2} {...form.register("outcome")} />
      </div>
      <div>
        <Label>Next action (datum)</Label>
        <DateTimePicker
          value={form.watch("next_action_date") ?? ""}
          onChange={(v) => form.setValue("next_action_date", v, { shouldDirty: true })}
        />
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting
          ? "Ukládám…"
          : mode.kind === "create" ? "Přidat aktivitu" : "Uložit změny"}
      </Button>
    </form>
  );
}
