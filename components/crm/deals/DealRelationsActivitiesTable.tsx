"use client";

import { useMemo, useState } from "react";
import { Coffee, Phone, Mail, BellRing, FileText, Search } from "lucide-react";
import type { crm_activities, crm_activity_type } from "@prisma/client";
import { UserAvatar } from "@/components/crm/UserAvatar";
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

type ActivityWithOwner = crm_activities & {
  owner: ActivityUser;
};

type Props = {
  activities: ActivityWithOwner[];
  companyName: string;
  currentUser: { id: number; role: Role };
  users: CrmUserOption[];
};

const TYPE_META: Record<crm_activity_type, { label: string; Icon: typeof Coffee }> = {
  MEETING: { label: "Schůzka", Icon: Coffee },
  CALL: { label: "Hovor", Icon: Phone },
  EMAIL: { label: "E-mail", Icon: Mail },
  REMINDER: { label: "Připomenutí", Icon: BellRing },
  NOTE: { label: "Poznámka", Icon: FileText },
};

function formatDateTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.toLocaleDateString("cs-CZ")} ${date.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}`;
}

function clamp(s: string | null, n: number): string {
  if (!s) return "—";
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

function ActivityTableRow({
  activity,
  companyName,
  currentUser,
  users,
}: {
  activity: ActivityWithOwner;
  companyName: string;
  currentUser: { id: number; role: Role };
  users: CrmUserOption[];
}) {
  const meta = TYPE_META[activity.type];
  const Icon = meta.Icon;
  const realized = activity.outcome !== null && activity.outcome !== "";
  const reminderDone = activity.type === "REMINDER" && activity.completed_at !== null;
  const completed_at = activity.completed_at
    ? typeof activity.completed_at === "string"
      ? new Date(activity.completed_at)
      : activity.completed_at
    : null;
  const editable = canEditActivity(currentUser, activity);
  const deletable = canDeleteActivity(currentUser, activity);
  const actions = useActivityActions({
    id: activity.id,
    owner_id: activity.owner_id,
    assignee_id: activity.assignee_id,
    type: activity.type,
  });

  return (
    <>
      <tr
        className={cn("hover:bg-muted/20", editable && "cursor-pointer")}
        onClick={editable ? actions.openEdit : undefined}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Icon className="size-4 text-muted-foreground" strokeWidth={1.75} />
            <span>{meta.label}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-muted-foreground">{formatDateTime(activity.date)}</td>
        <td className="px-4 py-3 font-medium">{clamp(activity.note, 60)}</td>
        <td className="px-4 py-3">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
              realized || reminderDone
                ? "bg-emerald-50 text-emerald-700"
                : "bg-muted/40 text-muted-foreground",
            )}
          >
            {realized
              ? "✓ Realizován"
              : reminderDone && completed_at
                ? `✓ Hotovo ${completed_at.toLocaleDateString("cs-CZ")}`
                : "Plánováno"}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <UserAvatar user={activity.owner} size="sm" />
            <span>{crmUserDisplayName(activity.owner)}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-muted-foreground">{companyName}</td>
        <td className="px-4 py-3 text-right">
          {deletable ? <ActivityRowActions onDelete={actions.deleteWithUndo} /> : null}
        </td>
      </tr>
      {editable ? (
        <ActivityEditDialog
          open={actions.editOpen}
          onOpenChange={actions.setEditOpen}
          activity={{
            id: activity.id,
            type: activity.type,
            date: activity.date,
            duration: activity.duration,
            note: activity.note,
            outcome: activity.outcome,
            next_action_date: activity.next_action_date,
            assignee_id: activity.assignee_id,
          }}
          users={users}
        />
      ) : null}
    </>
  );
}

export function DealRelationsActivitiesTable({ activities, companyName, currentUser, users }: Props) {
  const hidden = useHiddenActivities();
  const [search, setSearch] = useState("");
  const [types, setTypes] = useState<Set<crm_activity_type>>(new Set());
  const [statuses, setStatuses] = useState<Set<"realized" | "planned">>(new Set());

  const filtered = useMemo(() => {
    return activities.filter((a) => {
      if (hidden.isHidden(a.id)) return false;
      if (search && !(a.note ?? "").toLowerCase().includes(search.toLowerCase())) return false;
      if (types.size > 0 && !types.has(a.type)) return false;
      if (statuses.size > 0) {
        const realized = a.outcome !== null && a.outcome !== "";
        if (realized && !statuses.has("realized")) return false;
        if (!realized && !statuses.has("planned")) return false;
      }
      return true;
    });
  }, [activities, search, types, statuses, hidden]);

  function toggleType(t: crm_activity_type) {
    setTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  function toggleStatus(s: "realized" | "planned") {
    setStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Hledat v předmětu…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-full border border-border/50 bg-card py-2 pl-10 pr-4 text-sm shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
          />
        </div>

        <FilterChips<crm_activity_type>
          label="Typ"
          options={(Object.keys(TYPE_META) as crm_activity_type[]).map((t) => ({ value: t, label: TYPE_META[t].label }))}
          selected={types}
          onToggle={toggleType}
        />
        <FilterChips<"realized" | "planned">
          label="Stav"
          options={[{ value: "realized", label: "Realizováno" }, { value: "planned", label: "Plánováno" }]}
          selected={statuses}
          onToggle={toggleStatus}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/40">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Typ</th>
              <th className="px-4 py-3">Zaevidováno</th>
              <th className="px-4 py-3">Předmět</th>
              <th className="px-4 py-3">Stav</th>
              <th className="px-4 py-3">Vlastník</th>
              <th className="px-4 py-3">Klient</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  Žádné aktivity.
                </td>
              </tr>
            ) : (
              filtered.map((a) => (
                <ActivityTableRow
                  key={a.id}
                  activity={a}
                  companyName={companyName}
                  currentUser={currentUser}
                  users={users}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterChips<T extends string>({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: Set<T>;
  onToggle: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground">{label}:</span>
      {options.map((o) => {
        const active = selected.has(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onToggle(o.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition",
              active
                ? "border-sky-500 bg-sky-50 text-sky-700"
                : "border-border/50 bg-card text-muted-foreground hover:border-border",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
