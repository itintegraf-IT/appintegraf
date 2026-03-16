"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

type Notification = {
  id: number;
  title: string;
  message: string | null;
  type: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = () => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => {
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  const markAsRead = async (id: number) => {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    fetchNotifications();
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative rounded-lg p-2 hover:bg-[var(--accent)]"
        style={{ color: "var(--foreground)" }}
        aria-label="Notifikace"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            className="absolute right-1 top-1 flex h-4 w-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium"
            style={{ background: "var(--destructive)", color: "white" }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-80 max-h-[400px] overflow-y-auto rounded-lg border py-1 shadow-lg"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
          }}
        >
          <div
            className="border-b px-4 py-2"
            style={{ borderColor: "var(--border)" }}
          >
            <p className="font-medium" style={{ color: "var(--foreground)" }}>
              Notifikace
            </p>
          </div>
          {notifications.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
              Žádné notifikace
            </div>
          ) : (
            <div className="py-1">
              {notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.link ?? "#"}
                  onClick={() => {
                    if (!n.read_at) markAsRead(n.id);
                    setOpen(false);
                  }}
                  className={`block px-4 py-3 text-left text-sm hover:bg-[var(--accent)] ${
                    !n.read_at ? "bg-[var(--accent)]/30" : ""
                  }`}
                  style={{ color: "var(--foreground)" }}
                >
                  <p className="font-medium">{n.title}</p>
                  {n.message && (
                    <p className="mt-0.5 line-clamp-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                      {n.message}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
