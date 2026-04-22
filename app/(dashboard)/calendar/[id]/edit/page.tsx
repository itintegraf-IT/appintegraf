"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { EVENT_TYPES, DEFAULT_EVENT_TYPE, requiresDeputy, isAllDayEvent } from "../../lib/event-types";
import { REMINDER_MINUTE_OPTIONS } from "../../lib/calendar-form-options";

type Event = {
  id: number;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  event_type: string | null;
  department_id: number | null;
  deputy_id: number | null;
  is_public: boolean | null;
  location: string | null;
  color: string | null;
  remind_before_minutes?: number | null;
  reminder_notify_in_app?: boolean | null;
  reminder_notify_email?: boolean | null;
  users_deputy?: { id: number; first_name: string; last_name: string } | null;
};

type Department = { id: number; name: string };
type Deputy = { id: number; first_name: string; last_name: string };

export default function EditCalendarPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deputies, setDeputies] = useState<Deputy[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [deputyWarning, setDeputyWarning] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    start_date: "",
    end_date: "",
    event_type: DEFAULT_EVENT_TYPE,
    department_id: "",
    deputy_id: "",
    is_public: false,
    is_all_day: false,
    location: "",
    remind_before_minutes: "" as string,
    reminder_notify_in_app: true,
    reminder_notify_email: true,
  });

  useEffect(() => {
    Promise.all([
      fetch(`/api/calendar/${id}`).then((r) => r.json()),
      fetch("/api/departments").then((r) => r.json()),
      fetch("/api/calendar/deputies").then((r) => r.json()),
    ]).then(([event, depts, deputiesRes]: [Event, Department[], { deputies?: Deputy[] }]) => {
      if (event?.id) {
        const start = new Date(event.start_date);
        const end = new Date(event.end_date);
        const allDay = isAllDayEvent(start, end);
        setForm({
          title: event.title,
          description: event.description ?? "",
          start_date: start.toISOString().slice(0, 16),
          end_date: end.toISOString().slice(0, 16),
          event_type: event.event_type ?? DEFAULT_EVENT_TYPE,
          department_id: event.department_id ? String(event.department_id) : "",
          deputy_id: event.deputy_id ? String(event.deputy_id) : "",
          is_public: event.is_public ?? false,
          is_all_day: allDay,
          location: event.location ?? "",
          remind_before_minutes:
            event.remind_before_minutes != null && event.remind_before_minutes > 0
              ? String(event.remind_before_minutes)
              : "",
          reminder_notify_in_app: event.reminder_notify_in_app !== false,
          reminder_notify_email: event.reminder_notify_email !== false,
        });
      }
      setDepartments(Array.isArray(depts) ? depts : []);
      setDeputies(deputiesRes?.deputies ?? []);
    }).catch(() => setError("Chyba při načítání"))
      .finally(() => setLoadingData(false));
  }, [id]);

  useEffect(() => {
    const checkDeputyAvailability = async () => {
      if (!requiresDeputy(form.event_type) || !form.deputy_id) {
        setDeputyWarning("");
        return;
      }

      let startDate = form.start_date;
      let endDate = form.end_date;
      if (form.is_all_day) {
        const start = form.start_date.slice(0, 10);
        const end = form.end_date.slice(0, 10);
        startDate = `${start}T00:00`;
        endDate = `${end}T23:59`;
      }

      const query = new URLSearchParams({
        deputy_id: form.deputy_id,
        start_date: startDate,
        end_date: endDate,
        exclude_event_id: id,
      });

      const res = await fetch(`/api/calendar/deputies/check?${query.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeputyWarning("");
        return;
      }
      setDeputyWarning(data.hasConflict ? (data.warning ?? "Zástup má kolidující událost mimo firmu.") : "");
    };

    if (!loadingData) {
      checkDeputyAvailability().catch(() => setDeputyWarning(""));
    }
  }, [form.event_type, form.deputy_id, form.start_date, form.end_date, form.is_all_day, id, loadingData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setWarning("");
    setLoading(true);

    let startDate = form.start_date;
    let endDate = form.end_date;
    if (form.is_all_day) {
      const start = form.start_date.slice(0, 10);
      const end = form.end_date.slice(0, 10);
      startDate = `${start}T00:00`;
      endDate = `${end}T23:59`;
    }

    try {
      const res = await fetch(`/api/calendar/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          start_date: startDate,
          end_date: endDate,
          event_type: form.event_type,
          department_id: form.department_id || null,
          deputy_id: form.deputy_id || null,
          is_public: form.is_public,
          location: form.location,
          remind_before_minutes: form.remind_before_minutes || null,
          reminder_notify_in_app: form.reminder_notify_in_app,
          reminder_notify_email: form.reminder_notify_email,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Chyba při ukládání");
        setLoading(false);
        return;
      }

      if (data.warning) {
        setWarning(String(data.warning));
        window.alert(String(data.warning));
      }

      router.push(`/calendar/${id}`);
      router.refresh();
    } catch {
      setError("Chyba při ukládání");
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">Načítání…</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upravit událost</h1>
          <p className="mt-1 text-gray-600">{form.title || "Událost"}</p>
        </div>
        <Link
          href={`/calendar/${id}`}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}
        {warning && (
          <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{warning}</div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Název *</label>
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
              id="edit_is_all_day"
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
            <label htmlFor="edit_is_all_day" className="text-sm text-gray-700">
              Celý den
            </label>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Začátek *</label>
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
            <label className="mb-1 block text-sm font-medium text-gray-700">Konec *</label>
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
            <label className="mb-1 block text-sm font-medium text-gray-700">Typ události</label>
            <select
              value={form.event_type}
              onChange={(e) => {
                const v = e.target.value;
                setForm({ ...form, event_type: v, deputy_id: requiresDeputy(v) ? form.deputy_id : "" });
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
              <label className="mb-1 block text-sm font-medium text-gray-700">Zástup *</label>
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
              {deputies.length === 0 && (
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
            <label className="mb-1 block text-sm font-medium text-gray-700">Oddělení</label>
            <select
              value={form.department_id}
              onChange={(e) => setForm({ ...form, department_id: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="">—</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Místo</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Připomínka</label>
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
          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              id="is_public"
              checked={form.is_public}
              onChange={(e) => setForm({ ...form, is_public: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="is_public" className="text-sm text-gray-700">Veřejná událost</label>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Popis</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
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
            {loading ? "Ukládám…" : "Uložit"}
          </button>
          <Link
            href={`/calendar/${id}`}
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            Zrušit
          </Link>
        </div>
      </form>
    </>
  );
}
