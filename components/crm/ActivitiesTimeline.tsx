"use client";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import type { crm_activity_type } from "@prisma/client";
import {
  Phone,
  Calendar,
  Mail,
  BellRing,
  StickyNote,
  Activity as ActivityIcon,
  type LucideIcon,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/crm/UserAvatar";
import { useHiddenActivities } from "@/components/crm/activities/hidden-activities-context";
import { useActivityActions } from "@/components/crm/activities/use-activity-actions";
import { ActivityEditDialog } from "@/components/crm/activities/ActivityEditDialog";
import { ActivityRowActions } from "@/components/crm/activities/ActivityRowActions";
import { canEditActivity, canDeleteActivity } from "@/lib/crm/permissions/activity";
import type { Role } from "@/lib/crm/rbac";
import { crmUserDisplayName, type CrmUserOption } from "@/lib/crm/users";
import { cn } from "@/lib/utils";

type ActivityUser = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
};

type TimelineActivity = {
  id: string;
  type: crm_activity_type;
  date: Date | string;
  duration: number | null;
  note: string | null;
  outcome: string | null;
  next_action_date: Date | string | null;
  completed_at?: Date | string | null;
  owner_id: number;
  assignee_id: number | null;
  owner: ActivityUser | null;
  assignee: ActivityUser | null;
};

type CurrentUser = { id: number; role: Role };

const TYPE_LABEL: Record<crm_activity_type, string> = {
  CALL: "Hovor",
  MEETING: "Schůzka",
  EMAIL: "Email",
  REMINDER: "Připomenutí",
  NOTE: "Poznámka",
};

const TYPE_ICONS: Record<crm_activity_type, LucideIcon> = {
  CALL: Phone,
  MEETING: Calendar,
  EMAIL: Mail,
  REMINDER: BellRing,
  NOTE: StickyNote,
};

type Props = {
  activities: TimelineActivity[];
  currentUser: CurrentUser;
  users: CrmUserOption[];
};

export function ActivitiesTimeline({ activities, currentUser, users }: Props) {
  const hidden = useHiddenActivities();
  const visible = activities.filter((a) => !hidden.isHidden(a.id));

  if (visible.length === 0) {
    return (
      <EmptyState
        icon={ActivityIcon}
        title="Zatím žádné aktivity"
        description="Zalogované hovory, e-maily a schůzky se zobrazí zde."
      />
    );
  }
  return (
    <ol className="space-y-3">
      {visible.map((a) => (
        <ActivityRow key={a.id} activity={a} currentUser={currentUser} users={users} />
      ))}
    </ol>
  );
}

function ActivityRow({
  activity,
  currentUser,
  users,
}: {
  activity: TimelineActivity;
  currentUser: CurrentUser;
  users: CrmUserOption[];
}) {
  const editable = canEditActivity(currentUser, activity);
  const deletable = canDeleteActivity(currentUser, activity);
  const actions = useActivityActions({
    id: activity.id,
    owner_id: activity.owner_id,
    assignee_id: activity.assignee_id,
    type: activity.type,
  });
  const d = typeof activity.date === "string" ? new Date(activity.date) : activity.date;
  const Icon = TYPE_ICONS[activity.type] ?? ActivityIcon;
  const completed_at =
    activity.completed_at == null
      ? null
      : typeof activity.completed_at === "string"
        ? new Date(activity.completed_at)
        : activity.completed_at;
  const reminderCompleted = activity.type === "REMINDER" && completed_at !== null;

  return (
    <>
      <li
        onClick={editable ? actions.openEdit : undefined}
        className={cn(
          "flex gap-3 rounded-lg border border-border bg-card p-3",
          editable && "cursor-pointer transition hover:border-primary/40",
        )}
      >
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
          <Icon className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between text-sm">
            <div className="flex flex-wrap items-center gap-2 font-medium">
              <span>
                {TYPE_LABEL[activity.type]}
                {activity.duration ? ` · ${activity.duration} min` : ""}
              </span>
              {reminderCompleted && completed_at ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-normal text-emerald-700">
                  ✓ Hotovo {format(completed_at, "d. M. yyyy", { locale: cs })}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <time className="text-muted-foreground">
                {format(d, "d. M. yyyy HH:mm", { locale: cs })}
              </time>
              {deletable ? <ActivityRowActions onDelete={actions.deleteWithUndo} /> : null}
            </div>
          </div>
          {activity.note ? (
            <p
              className={cn(
                "mt-2 whitespace-pre-wrap text-sm",
                reminderCompleted && "line-through opacity-60",
              )}
            >
              {activity.note}
            </p>
          ) : null}
          {activity.outcome ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-success">
              <strong>Výsledek:</strong> {activity.outcome}
            </p>
          ) : null}
          {activity.next_action_date ? (
            <p className="mt-2 text-xs text-warning">
              Next action:{" "}
              {format(
                typeof activity.next_action_date === "string"
                  ? new Date(activity.next_action_date)
                  : activity.next_action_date,
                "d. M. yyyy HH:mm",
                { locale: cs },
              )}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {activity.owner ? (
              <UserAvatar user={activity.owner} size="xs" />
            ) : (
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-muted text-[9px] text-muted-foreground">
                ?
              </span>
            )}
            <span>{activity.owner ? crmUserDisplayName(activity.owner) : "(smazaný uživatel)"}</span>
            {activity.assignee ? (
              <>
                <span>→</span>
                <UserAvatar user={activity.assignee} size="xs" />
                <span>{crmUserDisplayName(activity.assignee)}</span>
              </>
            ) : null}
          </div>
        </div>
      </li>
      {editable ? (
        <ActivityEditDialog
          open={actions.editOpen}
          onOpenChange={actions.setEditOpen}
          activity={{
            ...activity,
            date: typeof activity.date === "string" ? new Date(activity.date) : activity.date,
            next_action_date:
              activity.next_action_date == null
                ? null
                : typeof activity.next_action_date === "string"
                  ? new Date(activity.next_action_date)
                  : activity.next_action_date,
          }}
          users={users}
        />
      ) : null}
    </>
  );
}
