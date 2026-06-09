"use client";

import type { crm_activities, crm_activity_type } from "@prisma/client";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { ActivityForm } from "./ActivityForm";
import { toDatetimeLocalInput } from "@/lib/crm/datetime-input";

const TYPE_LABELS: Record<crm_activity_type, string> = {
  CALL: "Hovor",
  MEETING: "Schůzka",
  EMAIL: "Email",
  REMINDER: "Připomenutí",
  NOTE: "Poznámka",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: Pick<
    crm_activities,
    "id" | "type" | "date" | "duration" | "note" | "outcome" | "next_action_date" | "assignee_id"
  >;
  users: { id: number; name: string | null; email: string | null }[];
};

export function ActivityEditDialog({ open, onOpenChange, activity, users }: Props) {
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Upravit aktivitu — ${TYPE_LABELS[activity.type]}`}
    >
      <ActivityForm
        mode={{ kind: "edit", activityId: activity.id, activityType: activity.type }}
        initialValues={{
          type: activity.type,
          date: toDatetimeLocalInput(activity.date),
          duration: activity.duration ? String(activity.duration) : "",
          note: activity.note ?? "",
          outcome: activity.outcome ?? "",
          next_action_date: toDatetimeLocalInput(activity.next_action_date),
          assignee_id: activity.assignee_id != null ? String(activity.assignee_id) : "",
        }}
        users={users}
        onSuccess={() => onOpenChange(false)}
      />
    </ResponsiveDialog>
  );
}
