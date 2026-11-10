"use client";

import { useState } from "react";
import { Bell, Calendar, ChevronDown } from "lucide-react";
import { NotificationLink } from "./NotificationLink";
import type { GroupableNotification } from "@/lib/notification-groups";

type Props = {
  calendar: GroupableNotification[];
  app: GroupableNotification[];
};

function NotificationGroup({
  title,
  icon: Icon,
  items,
  defaultOpen,
}: {
  title: string;
  icon: typeof Bell;
  items: GroupableNotification[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-gray-800 hover:bg-gray-50"
        aria-expanded={open}
      >
        <Icon className="h-4 w-4 shrink-0 text-gray-500" />
        <span className="flex-1">
          {title} ({items.length})
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="space-y-2 border-t border-gray-100 px-3 pb-3 pt-2">
          {items.map((n) => (
            <NotificationLink
              key={n.id}
              id={n.id}
              title={n.title}
              message={n.message}
              link={n.link}
              readAt={n.read_at}
              createdAt={n.created_at}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function DashboardNotifications({ calendar, app }: Props) {
  const total = calendar.length + app.length;
  if (total === 0) return null;

  const calendarOpen = calendar.length > 0;
  const appOpen = app.length <= 3 || calendar.length === 0;

  return (
    <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-elevated">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
        <Bell className="h-5 w-5 text-gray-600" />
        Notifikace ({total})
      </h2>
      <div className="space-y-3">
        <NotificationGroup
          title="Kalendář"
          icon={Calendar}
          items={calendar}
          defaultOpen={calendarOpen}
        />
        <NotificationGroup
          title="Aplikace"
          icon={Bell}
          items={app}
          defaultOpen={appOpen}
        />
      </div>
    </div>
  );
}
