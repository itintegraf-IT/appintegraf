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
  const [actionLoading, setActionLoading] = useState<Record<number, "approve" | "reject">>({});
  const [rejectOpenFor, setRejectOpenFor] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = () => {
    fetch("/api/notifications?unread=true")
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

  const handleNotificationClick = (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    void markAsRead(id);
    setOpen(false);
  };

  const respondToInvite = async (id: number, action: "approve" | "reject", reason?: string) => {
    setActionLoading((prev) => ({ ...prev, [id]: action }));
    setActionError(null);
    try {
      const res = await fetch(`/api/notifications/${id}/invite-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason: action === "reject" ? (reason ?? "").trim() : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Nepodařilo se zpracovat pozvánku");
      }
      setRejectOpenFor(null);
      setRejectReason("");
      fetchNotifications();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Nepodařilo se zpracovat pozvánku");
    } finally {
      setActionLoading((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
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
              {notifications.map((n) =>
                n.type === "calendar_invite" && !n.read_at ? (
                  <div
                    key={n.id}
                    className="block border-l-[3px] border-blue-500 bg-blue-50/80 px-4 py-3 text-left text-sm dark:bg-blue-950/50"
                    style={{ color: "var(--foreground)" }}
                  >
                    <p className="flex items-center gap-2 font-medium">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-hidden />
                      {n.title}
                    </p>
                    {n.message && (
                      <p className="mt-0.5 line-clamp-2 pl-4 text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {n.message}
                      </p>
                    )}
                    <div className="mt-2">
                      {rejectOpenFor === n.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Důvod zamítnutí pozvánky"
                            rows={3}
                            className="w-full rounded border px-2 py-1 text-xs"
                            style={{
                              borderColor: "var(--border)",
                              background: "var(--background)",
                              color: "var(--foreground)",
                            }}
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => respondToInvite(n.id, "reject", rejectReason)}
                              disabled={actionLoading[n.id] === "reject"}
                              className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-60"
                            >
                              {actionLoading[n.id] === "reject" ? "Odesílám…" : "Potvrdit zamítnutí"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRejectOpenFor(null);
                                setRejectReason("");
                                setActionError(null);
                              }}
                              className="rounded border px-2 py-1 text-xs"
                              style={{ borderColor: "var(--border)" }}
                            >
                              Zrušit
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => respondToInvite(n.id, "approve")}
                            disabled={!!actionLoading[n.id]}
                            className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-60"
                          >
                            {actionLoading[n.id] === "approve" ? "Schvaluji…" : "Schválit"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectOpenFor(n.id);
                              setActionError(null);
                              setRejectReason("");
                            }}
                            disabled={!!actionLoading[n.id]}
                            className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-60"
                          >
                            Zamítnout
                          </button>
                        </div>
                      )}
                      {actionError && rejectOpenFor === n.id && (
                        <p className="mt-1 text-xs text-red-600">{actionError}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <Link
                    key={n.id}
                    href={n.link ?? "#"}
                    onClick={() => handleNotificationClick(n.id)}
                    className="block border-l-[3px] border-blue-500 bg-blue-50/80 px-4 py-3 text-left text-sm hover:bg-blue-100/80 dark:bg-blue-950/50 dark:hover:bg-blue-950/70"
                    style={{ color: "var(--foreground)" }}
                  >
                    <p className="flex items-center gap-2 font-medium">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-hidden />
                      {n.title}
                    </p>
                    {n.message && (
                      <p className="mt-0.5 line-clamp-2 pl-4 text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {n.message}
                      </p>
                    )}
                  </Link>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
