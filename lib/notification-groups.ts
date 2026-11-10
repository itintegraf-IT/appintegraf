/** Kalendář / rezervace zdrojů — prefixy `calendar_` a `resource_`. */
export function isCalendarNotification(type: string | null | undefined): boolean {
  if (!type) return false;
  return type.startsWith("calendar_") || type.startsWith("resource_");
}

export type GroupableNotification = {
  id: number;
  title: string;
  message: string | null;
  type?: string | null;
  link: string | null;
  read_at: Date | null;
  created_at: Date;
};

export function splitNotificationsByGroup<T extends GroupableNotification>(
  notifications: T[]
): { calendar: T[]; app: T[] } {
  const calendar: T[] = [];
  const app: T[] = [];
  for (const n of notifications) {
    if (isCalendarNotification(n.type)) {
      calendar.push(n);
    } else {
      app.push(n);
    }
  }
  return { calendar, app };
}
