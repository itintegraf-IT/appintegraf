"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";
import { EVENT_TYPES, DEFAULT_EVENT_TYPE, requiresDeputy } from "./lib/event-types";
import { RECURRENCE_OPTIONS, REMINDER_MINUTE_OPTIONS } from "./lib/calendar-form-options";
import {
  allDayYmdRangeToIsoStrings,
  formatDateLocal,
  formatDateTimeLocalForInput,
} from "./lib/week-utils";
import { CalendarInviteeSelect } from "./CalendarInviteeSelect";

type Department = { id: number; name: string; code: string | null };
type Deputy = { id: number; first_name: string; last_name: string };
type Invitee = { id: number; first_name: string; last_name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  initialStart: Date;
  initialEnd: Date;
  allDay?: boolean;
};

export function CreateEventModal({
  open,
  onClose,
  initialStart,
  initialEnd,
  allDay = false,
}: Props) {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deputies, setDeputies] = useState<Deputy[]>([]);
  const [invitees, setInvitees] = useState<Invitee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deputyWarning, setDeputyWarning] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    start_date: formatDateTimeLocalForInput(initialStart),
    end_date: formatDateTimeLocalForInput(initialEnd),
    event_type: DEFAULT_EVENT_TYPE,
    department_id: "",
    deputy_id: "",
    is_private: false,
    is_all_day: allDay,
    location: "",
    recurrence: "none" as (typeof RECURRENCE_OPTIONS)[number]["value"],
    recurrence_end: (() => {
      const d = new Date(initialStart);
      d.setMonth(d.getMonth() + 3);
      return formatDateLocal(d);
    })(),
    remind_before_minutes: "" as string,
    reminder_notify_in_app: true,
    reminder_notify_email: true,
    participant_ids: [] as number[],
  });

  useEffect(() => {
    if (open) {
      const start = new Date(initialStart);
      const end = new Date(initialEnd);
      if (allDay) {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 0, 0);
      }
      const re = new Date(start);
      re.setMonth(re.getMonth() + 3);
      setForm((f) => ({
        ...f,
        start_date: formatDateTimeLocalForInput(start),
        end_date: formatDateTimeLocalForInput(end),
        is_all_day: allDay,
        recurrence_end: formatDateLocal(re),
      }));
      setError("");
      setDeputyWarning("");
    }
  }, [open, initialStart, initialEnd, allDay]);

  useEffect(() => {
    fetch("/api/departments")
      .then((r) => r.json())
      .then((data) => (Array.isArray(data) ? setDepartments(data) : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/calendar/deputies")
      .then((r) => r.json())
      .then((data) => setDeputies(data.deputies ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/calendar/invitees")
      .then((r) => r.json())
      .then((data) => (Array.isArray(data.users) ? setInvitees(data.users) : setInvitees([])))
      .catch(() => setInvitees([]));
  }, []);

  useEffect(() => {
    const checkDeputyAvailability = async () => {
      if (!open || !requiresDeputy(form.event_type) || !form.deputy_id) {
        setDeputyWarning("");
        return;
      }

      let startDate = form.start_date;
      let endDate = form.end_date;
      if (form.is_all_day) {
        const { start, end } = allDayYmdRangeToIsoStrings(
          form.start_date.slice(0, 10),
          form.end_date.slice(0, 10)
        );
        startDate = start;
        endDate = end;
      } else {
        startDate = new Date(form.start_date).toISOString();
        endDate = new Date(form.end_date).toISOString();
      }

      const query = new URLSearchParams({
        deputy_id: form.deputy_id,
        start_date: startDate,
        end_date: endDate,
      });

      const res = await fetch(`/api/calendar/deputies/check?${query.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeputyWarning("");
        return;
      }
      setDeputyWarning(data.hasConflict ? (data.warning ?? "Zástup má kolidující událost mimo firmu.") : "");
    };

    checkDeputyAvailability().catch(() => setDeputyWarning(""));
  }, [open, form.event_type, form.deputy_id, form.start_date, form.end_date, form.is_all_day]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    let startDate: string;
    let endDate: string;
    if (form.is_all_day) {
      const s = form.start_date.slice(0, 10);
      const e = form.end_date.length >= 10 ? form.end_date.slice(0, 10) : s;
      const r = allDayYmdRangeToIsoStrings(s, e);
      startDate = r.start;
      endDate = r.end;
    } else {
      startDate = new Date(form.start_date).toISOString();
      endDate = new Date(form.end_date).toISOString();
    }

    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          start_date: startDate,
          end_date: endDate,
          event_type: form.event_type,
          department_id: form.department_id || null,
          deputy_id: form.deputy_id || null,
          is_private: form.is_private,
          location: form.location,
          recurrence: form.recurrence,
          recurrence_end: form.recurrence === "none" ? null : form.recurrence_end,
          remind_before_minutes: form.remind_before_minutes || null,
          reminder_notify_in_app: form.reminder_notify_in_app,
          reminder_notify_email: form.reminder_notify_email,
          participant_user_ids: form.participant_ids,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Chyba při ukládání");
        return;
      }

      onClose();
      router.refresh();
    } catch {
      setError("Chyba při ukládání");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Nová událost</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Zavřít"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Název *
              </label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                id="modal_is_all_day"
                checked={form.is_all_day}
                onChange={(e) => {
                  const checked = e.target.checked;
                  if (checked) {
                    const start = form.start_date.slice(0, 10);
                    const end = form.end_date.slice(0, 10);
                    setForm({
                      ...form,
                      is_all_day: true,
                      start_date: `${start}T00:00`,
                      end_date: `${end}T23:59`,
                    });
                  } else {
                    const start = form.start_date.slice(0, 10);
                    setForm({
                      ...form,
                      is_all_day: false,
                      start_date: `${start}T09:00`,
                      end_date: `${start}T17:00`,
                    });
                  }
                }}
                className="rounded"
              />
              <label htmlFor="modal_is_all_day" className="text-sm text-gray-700">
                Celý den
              </label>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Začátek *
              </label>
              <input
                type={form.is_all_day ? "date" : "datetime-local"}
                required
                value={form.is_all_day ? form.start_date.slice(0, 10) : form.start_date}
                onChange={(e) => {
                  const v = e.target.value;
                  if (form.is_all_day) {
                    const end = form.end_date.slice(0, 10);
                    setForm({
                      ...form,
                      start_date: `${v}T00:00`,
                      end_date: `${end}T23:59`,
                    });
                  } else {
                    setForm({ ...form, start_date: v });
                  }
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Konec *
              </label>
              <input
                type={form.is_all_day ? "date" : "datetime-local"}
                required
                value={form.is_all_day ? form.end_date.slice(0, 10) : form.end_date}
                onChange={(e) => {
                  const v = e.target.value;
                  if (form.is_all_day) {
                    const start = form.start_date.slice(0, 10);
                    setForm({
                      ...form,
                      start_date: `${start}T00:00`,
                      end_date: `${v}T23:59`,
                    });
                  } else {
                    setForm({ ...form, end_date: v });
                  }
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Typ události
              </label>
              <select
                value={form.event_type}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm({
                    ...form,
                    event_type: v,
                    deputy_id: requiresDeputy(v) ? form.deputy_id : "",
                    recurrence: requiresDeputy(v) ? "none" : form.recurrence,
                  });
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            {requiresDeputy(form.event_type) && (
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Zástup *
                </label>
                <select
                  required
                  value={form.deputy_id}
                  onChange={(e) => setForm({ ...form, deputy_id: e.target.value })}
                  className={`w-full rounded-lg px-3 py-2 ${
                    deputyWarning
                      ? "border border-red-400 bg-red-50 text-red-900 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                      : "border border-gray-300"
                  }`}
                >
                  <option value="">— Vyberte zástupa —</option>
                  {deputies.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.first_name} {d.last_name}
                    </option>
                  ))}
                </select>
                {deputies.length === 0 && requiresDeputy(form.event_type) && (
                  <p className="mt-1 text-xs text-amber-600">
                    Nemáte přiřazeno oddělení nebo v oddělení nejsou další uživatelé.
                  </p>
                )}
                {deputyWarning && (
                  <div className="mt-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-800">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <p>{deputyWarning}</p>
                  </div>
                )}
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Oddělení
              </label>
              <select
                value={form.department_id}
                onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="">—</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Místo
              </label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Další účastníci</label>
              <p className="mb-2 text-xs text-gray-500">Hledáním nebo hromadně podle oddělení.</p>
              <CalendarInviteeSelect
                invitees={invitees}
                value={form.participant_ids}
                onChange={(ids) => setForm({ ...form, participant_ids: ids })}
                excludeIds={form.deputy_id ? [parseInt(form.deputy_id, 10)] : []}
                disabled={loading}
                departments={departments.map((d) => ({ id: d.id, name: d.name }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Opakování
              </label>
              <select
                value={form.recurrence}
                onChange={(e) =>
                  setForm({ ...form, recurrence: e.target.value as (typeof RECURRENCE_OPTIONS)[number]["value"] })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                disabled={requiresDeputy(form.event_type)}
                title={requiresDeputy(form.event_type) ? "U Dovolená/Osobní není opakování k dispozici." : undefined}
              >
                {RECURRENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {form.recurrence !== "none" && !requiresDeputy(form.event_type) && (
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Opakovat do (včetně) *
                </label>
                <input
                  type="date"
                  required
                  value={form.recurrence_end}
                  onChange={(e) => setForm({ ...form, recurrence_end: e.target.value })}
                  className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Připomínka
              </label>
              <select
                value={form.remind_before_minutes}
                onChange={(e) => setForm({ ...form, remind_before_minutes: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                {REMINDER_MINUTE_OPTIONS.map((o) => (
                  <option key={o.value || "none"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {form.remind_before_minutes !== "" && (
              <div className="flex flex-col gap-2 sm:col-span-2">
                <span className="text-sm font-medium text-gray-700">Upozornit přes</span>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.reminder_notify_in_app}
                      onChange={(e) => setForm({ ...form, reminder_notify_in_app: e.target.checked })}
                      className="rounded"
                    />
                    Notifikace v aplikaci
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.reminder_notify_email}
                      onChange={(e) => setForm({ ...form, reminder_notify_email: e.target.checked })}
                      className="rounded"
                    />
                    E-mail
                  </label>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-1 sm:col-span-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="modal_is_private"
                  checked={form.is_private}
                  onChange={(e) => setForm({ ...form, is_private: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="modal_is_private" className="text-sm text-gray-700">
                  Soukromá událost
                </label>
              </div>
              <p className="pl-6 text-xs text-gray-500">
                Nebude v globálním kalendáři, jen u vás a u zapojených osob.
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Popis
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
          </div>

          <div className="mt-6 flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? "Ukládám…" : "Vytvořit událost"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Zrušit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
