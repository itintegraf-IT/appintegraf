"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Coffee, Phone, Mail, BellRing, FileText, Plus } from "lucide-react";
import type { crm_activities, crm_activity_type, crm_audit_log, crm_deal_stage } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ActivityForm } from "@/components/crm/activities/ActivityForm";
import { UserAvatar } from "@/components/crm/UserAvatar";
import { STAGE_LABELS, STAGE_BADGE, STAGE_BADGE_DOT } from "@/lib/crm/deal-stages";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/crm/rbac";
import { crmUserDisplayName, type CrmUserOption } from "@/lib/crm/users";
import { useHiddenActivities } from "@/components/crm/activities/hidden-activities-context";
import { useActivityActions } from "@/components/crm/activities/use-activity-actions";
import { ActivityEditDialog } from "@/components/crm/activities/ActivityEditDialog";
import { ActivityRowActions } from "@/components/crm/activities/ActivityRowActions";
import { canEditActivity, canDeleteActivity } from "@/lib/crm/permissions/activity";

type ActivityUser = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
};

type ActivityWithUsers = crm_activities & {
  owner: ActivityUser;
  assignee: ActivityUser | null;
};

type StageLog = crm_audit_log & {
  user: ActivityUser | null;
};

type StageEvent = {
  kind: "stage";
  id: string;
  date: Date;
  from: crm_deal_stage;
  to: crm_deal_stage;
  user: StageLog["user"];
};

type ActivityEvent = {
  kind: "activity";
  id: string;
  date: Date;
  activity: ActivityWithUsers;
};

type TimelineEvent = StageEvent | ActivityEvent;

type Props = {
  dealId: string;
  activities: ActivityWithUsers[];
  stageLogs: StageLog[];
  users: CrmUserOption[];
  currentUser: { id: number; role: Role };
  canEdit: boolean;
};

const TYPE_META: Record<crm_activity_type, { label: string; Icon: typeof Coffee; bg: string; fg: string }> = {
  MEETING: { label: "Schůzka", Icon: Coffee, bg: "bg-emerald-100", fg: "text-emerald-600" },
  CALL: { label: "Hovor", Icon: Phone, bg: "bg-sky-100", fg: "text-sky-600" },
  EMAIL: { label: "E-mail", Icon: Mail, bg: "bg-violet-100", fg: "text-violet-600" },
  REMINDER: { label: "Připomenutí", Icon: BellRing, bg: "bg-amber-100", fg: "text-amber-600" },
  NOTE: { label: "Poznámka", Icon: FileText, bg: "bg-slate-100", fg: "text-slate-600" },
};

function formatDate(d: Date): string {
  return d.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
}

function isRealized(a: ActivityWithUsers): boolean {
  return a.outcome !== null && a.outcome !== "";
}

export function DealTimeline({ dealId, activities, stageLogs, users, currentUser, canEdit }: Props) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const now = new Date();

  const hidden = useHiddenActivities();
  const visibleActivities = activities.filter((a) => !hidden.isHidden(a.id));

  const upcoming = visibleActivities
    .filter((a) => new Date(a.date).getTime() >= now.getTime() && !isRealized(a))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const pastActivityEvents: ActivityEvent[] = visibleActivities
    .filter((a) => new Date(a.date).getTime() < now.getTime() || isRealized(a))
    .map((a) => ({ kind: "activity", id: a.id, date: new Date(a.date), activity: a }));

  const stageEvents: StageEvent[] = [];
  for (const log of stageLogs) {
    const diff = log.diff as Record<string, { before: unknown; after: unknown }> | null;
    const sd = diff?.stage;
    if (sd && typeof sd.before === "string" && typeof sd.after === "string") {
      stageEvents.push({
        kind: "stage",
        id: log.id,
        date: log.created_at,
        from: sd.before as crm_deal_stage,
        to: sd.after as crm_deal_stage,
        user: log.user,
      });
    }
  }

  const past: TimelineEvent[] = [...pastActivityEvents, ...stageEvents].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );

  const upcomingEvents: ActivityEvent[] = upcoming.map((a) => ({
    kind: "activity", id: a.id, date: new Date(a.date), activity: a,
  }));

  return (
    <div className="space-y-8">
      {canEdit ? (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-600 active:scale-95"
          >
            <Plus className="size-4" strokeWidth={2.5} />
            Přidat aktivitu
          </button>
        </div>
      ) : null}

      {upcomingEvents.length > 0 ? (
        <Section title="Co nás čeká" events={upcomingEvents} currentUser={currentUser} users={users} />
      ) : null}

      {past.length > 0 ? (
        <Section title="Co máme za sebou" events={past} currentUser={currentUser} users={users} />
      ) : (
        <div className="rounded-2xl bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
          Zatím tu nic není. Přidej první aktivitu klepnutím na <span className="font-semibold">+</span>.
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-xl rounded-3xl">
          <DialogHeader>
            <DialogTitle>Nová aktivita</DialogTitle>
          </DialogHeader>
          <ActivityForm
            mode={{ kind: "create", parent_type: "DEAL", parent_id: dealId }}
            users={users}
            onSuccess={() => {
              setAddOpen(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({
  title,
  events,
  currentUser,
  users,
}: {
  title: string;
  events: TimelineEvent[];
  currentUser: { id: number; role: Role };
  users: CrmUserOption[];
}) {
  return (
    <div>
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <ol className="relative space-y-3">
        {events.map((event) => (
          <li key={`${event.kind}-${event.id}`} className="flex gap-4">
            <div className="w-24 shrink-0 pt-2 text-right">
              <div className="text-sm font-medium">{formatDate(event.date)}</div>
              <div className="text-xs text-muted-foreground">{formatTime(event.date)}</div>
            </div>
            <div className="flex flex-1 items-start gap-4">
              {event.kind === "activity" ? (
                <ActivityRow event={event} currentUser={currentUser} users={users} />
              ) : (
                <StageRow event={event} />
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ActivityRow({
  event,
  currentUser,
  users,
}: {
  event: ActivityEvent;
  currentUser: { id: number; role: Role };
  users: CrmUserOption[];
}) {
  const a = event.activity;
  const meta = TYPE_META[a.type];
  const Icon = meta.Icon;
  const realized = isRealized(a);
  const editable = canEditActivity(currentUser, { owner_id: a.owner_id, assignee_id: a.assignee_id });
  const deletable = canDeleteActivity(currentUser, { owner_id: a.owner_id, assignee_id: a.assignee_id });
  const actions = useActivityActions({
    id: a.id,
    owner_id: a.owner_id,
    assignee_id: a.assignee_id,
    type: a.type,
  });

  return (
    <>
      <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", meta.bg, meta.fg)}>
        <Icon className="size-5" strokeWidth={1.75} />
      </div>
      <div
        onClick={editable ? actions.openEdit : undefined}
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-2 rounded-2xl border border-border/40 bg-card px-4 py-3 shadow-sm",
          editable && "cursor-pointer transition hover:border-primary/40",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{meta.label}</span>
            {realized ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                ✓ Realizován
              </span>
            ) : a.type === "REMINDER" && a.completed_at ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                ✓ Hotovo {formatDate(new Date(a.completed_at))}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
                Plánováno
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
            <UserAvatar user={a.owner} size="sm" />
            <span className="hidden sm:inline">{crmUserDisplayName(a.owner)}</span>
            {deletable ? <ActivityRowActions onDelete={actions.deleteWithUndo} /> : null}
          </div>
        </div>
        {a.note ? (
          <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{a.note}</p>
        ) : null}
        {a.outcome ? (
          <p className="whitespace-pre-wrap break-words text-sm text-emerald-700">
            <strong className="font-semibold">Výsledek:</strong> {a.outcome}
          </p>
        ) : null}
      </div>
      {editable ? (
        <ActivityEditDialog
          open={actions.editOpen}
          onOpenChange={actions.setEditOpen}
          activity={{
            id: a.id,
            type: a.type,
            date: a.date,
            duration: a.duration,
            note: a.note,
            outcome: a.outcome,
            next_action_date: a.next_action_date,
            assignee_id: a.assignee_id,
          }}
          users={users}
        />
      ) : null}
    </>
  );
}

function StagePill({ stage }: { stage: crm_deal_stage }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        STAGE_BADGE[stage],
      )}
    >
      <span className={cn("size-1.5 rounded-full", STAGE_BADGE_DOT[stage])} aria-hidden />
      {STAGE_LABELS[stage]}
    </span>
  );
}

function StageRow({ event }: { event: StageEvent }) {
  return (
    <>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white">
        <ArrowRight className="size-5" strokeWidth={2} />
      </div>
      <div className="flex flex-1 items-center justify-between gap-3 rounded-2xl border border-border/40 bg-card px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">Změna fáze</span>
          <span className="text-muted-foreground">·</span>
          <StagePill stage={event.from} />
          <span className="text-muted-foreground">→</span>
          <StagePill stage={event.to} />
        </div>
        {event.user ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <UserAvatar user={event.user} size="sm" />
            <span>{crmUserDisplayName(event.user)}</span>
          </div>
        ) : null}
      </div>
    </>
  );
}
