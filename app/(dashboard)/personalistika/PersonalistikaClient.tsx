"use client";

import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Save, Plus, Trash2, Pencil, X } from "lucide-react";

type Application = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  position_id: number | null;
  position_name: string | null;
  notes: string | null;
  status: "new" | "in_review" | "invited" | "rejected" | "accepted";
  source: "kiosk" | "web" | "internal";
  valid_from: string | null;
  valid_to: string | null;
  created_at: string;
  details?: {
    title?: string;
    date_of_birth?: string;
    citizenship?: string;
    correspondence_address?: {
      street?: string;
      number?: string;
      city?: string;
      zip?: string;
    };
    education_level?: string;
    education_details?: string;
    courses?: string;
    languages?: {
      en?: string;
      de?: string;
      fr?: string;
      ru?: string;
      pl?: string;
      other?: string;
    };
    employment?: {
      employer_name?: string;
      employer_address?: string;
      position_description?: string;
    };
    work_type?: string;
    possible_start?: string;
    additional_notes?: string;
  } | null;
  consent_given?: number | null;
  consent_date?: string | null;
  attachment_path?: string | null;
  attachment_original_name?: string | null;
};

type Position = {
  id: number;
  name: string;
  is_active: number;
};

type PartTimerStatus =
  | "student"
  | "duchodce"
  | "nezamestnany"
  | "zamestnany"
  | "osvc"
  | "materska_rodicovska"
  | "jine";

type PartTimer = {
  id: number;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  status: PartTimerStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type PartTimerForm = {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  status: PartTimerStatus;
  notes: string;
};

const PART_TIMER_STATUS_LABELS: Record<PartTimerStatus, string> = {
  student: "Student",
  duchodce: "Důchodce",
  nezamestnany: "Nezaměstnaný",
  zamestnany: "Zaměstnaný",
  osvc: "OSVČ",
  materska_rodicovska: "Mateřská/rodičovská",
  jine: "Jiné",
};

const EMPTY_PART_TIMER: PartTimerForm = {
  first_name: "",
  last_name: "",
  phone: "",
  email: "",
  status: "student",
  notes: "",
};

type Attachment = {
  id: number;
  original_filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_by: number;
  created_at: string;
  users: { first_name: string; last_name: string } | null;
};

const STATUS_LABELS: Record<Application["status"], string> = {
  new: "Nový",
  in_review: "V řešení",
  invited: "Pozván",
  rejected: "Zamítnut",
  accepted: "Přijat",
};

export function PersonalistikaClient({ canWrite }: { canWrite: boolean }) {
  const [tab, setTab] = useState<"applications" | "positions" | "part_timers">("applications");
  const [applications, setApplications] = useState<Application[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<Application | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [newPosition, setNewPosition] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pdfPreviewId, setPdfPreviewId] = useState<number | null>(null);

  const [partTimers, setPartTimers] = useState<PartTimer[]>([]);
  const [partTimerQuery, setPartTimerQuery] = useState("");
  const [editingPartTimerId, setEditingPartTimerId] = useState<number | "new" | null>(null);
  const [partTimerForm, setPartTimerForm] = useState<PartTimerForm>(EMPTY_PART_TIMER);

  const loadApplications = async () => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (status !== "all") params.set("status", status);
    const res = await fetch(`/api/personalistika/applications?${params}`);
    const data = await res.json().catch(() => ({}));
    setApplications(data.applications ?? []);
  };

  const loadPositions = async () => {
    const res = await fetch("/api/personalistika/positions");
    const data = await res.json().catch(() => ({}));
    setPositions(data.positions ?? []);
  };

  const loadPartTimers = async () => {
    const params = new URLSearchParams();
    if (partTimerQuery) params.set("q", partTimerQuery);
    const res = await fetch(`/api/personalistika/part-timers?${params}`);
    const data = await res.json().catch(() => ({}));
    setPartTimers(data.partTimers ?? []);
  };

  useEffect(() => {
    loadApplications();
  }, [query, status]);

  useEffect(() => {
    loadPositions();
  }, []);

  useEffect(() => {
    if (tab === "part_timers") {
      loadPartTimers();
    }
  }, [tab, partTimerQuery]);

  useEffect(() => {
    const loadAttachments = async () => {
      if (!selected) {
        setAttachments([]);
        return;
      }
      const res = await fetch(`/api/personalistika/applications/${selected.id}/attachments`);
      const data = await res.json().catch(() => ({}));
      setAttachments(data.files ?? []);
    };
    loadAttachments();
  }, [selected?.id]);

  useEffect(() => {
    const loadSelectedDetail = async () => {
      if (!selected?.id) return;
      const res = await fetch(`/api/personalistika/applications/${selected.id}`);
      const data = await res.json().catch(() => ({}));
      if (data.application) {
        setSelected((prev) => (prev && prev.id === data.application.id ? { ...prev, ...data.application } : prev));
      }
    };
    loadSelectedDetail();
  }, [selected?.id]);

  const statusOptions = useMemo(
    () => [
      { value: "all", label: "Vše" },
      { value: "new", label: STATUS_LABELS.new },
      { value: "in_review", label: STATUS_LABELS.in_review },
      { value: "invited", label: STATUS_LABELS.invited },
      { value: "rejected", label: STATUS_LABELS.rejected },
      { value: "accepted", label: STATUS_LABELS.accepted },
    ],
    []
  );

  const saveApplication = async () => {
    if (!selected) return;
    setError("");
    setSuccess("");
    const res = await fetch(`/api/personalistika/applications/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(selected),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Nepodařilo se uložit dotazník.");
      return;
    }
    setSuccess("Dotazník byl uložen.");
    await loadApplications();
  };

  const createPosition = async () => {
    if (!newPosition.trim()) return;
    setError("");
    const res = await fetch("/api/personalistika/positions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newPosition }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Pozici nelze vytvořit.");
      return;
    }
    setNewPosition("");
    await loadPositions();
  };

  const updatePosition = async (pos: Position, patch: Partial<Position>) => {
    const res = await fetch(`/api/personalistika/positions/${pos.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...pos, ...patch }),
    });
    if (!res.ok) return;
    await loadPositions();
    await loadApplications();
  };

  const removePosition = async (id: number) => {
    if (!confirm("Smazat pozici?")) return;
    const res = await fetch(`/api/personalistika/positions/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    await loadPositions();
    await loadApplications();
  };

  const uploadAttachment = async (file: File | null) => {
    if (!selected || !file) return;
    setUploading(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/personalistika/applications/${selected.id}/attachments`, {
      method: "POST",
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Nahrání přílohy se nezdařilo.");
      setUploading(false);
      return;
    }
    const refresh = await fetch(`/api/personalistika/applications/${selected.id}/attachments`);
    const refreshData = await refresh.json().catch(() => ({}));
    setAttachments(refreshData.files ?? []);
    setUploading(false);
  };

  const deleteAttachment = async (fileId: number) => {
    if (!selected) return;
    const res = await fetch(`/api/personalistika/applications/${selected.id}/attachments/${fileId}`, {
      method: "DELETE",
    });
    if (!res.ok) return;
    setAttachments((prev) => prev.filter((x) => x.id !== fileId));
  };

  const isPdf = (mime: string) => mime.trim().toLowerCase() === "application/pdf";

  const startNewPartTimer = () => {
    setEditingPartTimerId("new");
    setPartTimerForm(EMPTY_PART_TIMER);
    setError("");
    setSuccess("");
  };

  const startEditPartTimer = (pt: PartTimer) => {
    setEditingPartTimerId(pt.id);
    setPartTimerForm({
      first_name: pt.first_name,
      last_name: pt.last_name,
      phone: pt.phone ?? "",
      email: pt.email ?? "",
      status: pt.status,
      notes: pt.notes ?? "",
    });
    setError("");
    setSuccess("");
  };

  const cancelPartTimerEdit = () => {
    setEditingPartTimerId(null);
    setPartTimerForm(EMPTY_PART_TIMER);
  };

  const savePartTimer = async () => {
    if (editingPartTimerId === null) return;
    setError("");
    setSuccess("");

    const isNew = editingPartTimerId === "new";
    const url = isNew
      ? "/api/personalistika/part-timers"
      : `/api/personalistika/part-timers/${editingPartTimerId}`;
    const method = isNew ? "POST" : "PUT";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partTimerForm),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Brigádníka se nepodařilo uložit.");
      return;
    }
    setSuccess(isNew ? "Brigádník byl přidán." : "Brigádník byl uložen.");
    cancelPartTimerEdit();
    await loadPartTimers();
  };

  const removePartTimer = async (id: number) => {
    if (!confirm("Smazat brigádníka?")) return;
    setError("");
    setSuccess("");
    const res = await fetch(`/api/personalistika/part-timers/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Smazání se nezdařilo.");
      return;
    }
    if (editingPartTimerId === id) cancelPartTimerEdit();
    await loadPartTimers();
  };

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <BriefcaseBusiness className="h-7 w-7 text-red-600" />
            Personalistika
          </h1>
          <p className="mt-1 text-gray-600">Přijaté dotazníky uchazečů a správa pracovních pozic.</p>
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      <div className="mb-4 flex rounded-lg border border-gray-200 bg-white p-1 w-fit">
        <button
          onClick={() => setTab("applications")}
          className={`rounded-md px-4 py-2 text-sm ${tab === "applications" ? "bg-gray-100 font-medium" : ""}`}
        >
          Dotazníky
        </button>
        <button
          onClick={() => setTab("positions")}
          className={`rounded-md px-4 py-2 text-sm ${tab === "positions" ? "bg-gray-100 font-medium" : ""}`}
        >
          Pracovní pozice
        </button>
        <button
          onClick={() => setTab("part_timers")}
          className={`rounded-md px-4 py-2 text-sm ${tab === "part_timers" ? "bg-gray-100 font-medium" : ""}`}
        >
          Brigádníci
        </button>
      </div>

      {tab === "applications" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 p-4">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Hledat uchazeče..."
                className="rounded-lg border border-gray-300 px-3 py-2"
              />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Uchazeč</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Pozice</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Kontakt</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Stav</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                        Zatím žádné záznamy
                      </td>
                    </tr>
                  ) : (
                    applications.map((a) => (
                      <tr
                        key={a.id}
                        onClick={() => setSelected(a)}
                        className={`cursor-pointer border-b border-gray-100 hover:bg-gray-50 ${
                          selected?.id === a.id ? "bg-red-50/40" : ""
                        }`}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">{a.last_name} {a.first_name}</td>
                        <td className="px-4 py-3">{a.position_name ?? "-"}</td>
                        <td className="px-4 py-3 text-sm">{a.email}</td>
                        <td className="px-4 py-3">{STATUS_LABELS[a.status]}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            {!selected ? (
              <p className="text-sm text-gray-500">Vyberte dotazník ze seznamu.</p>
            ) : (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-gray-900">Detail dotazníku #{selected.id}</h2>
                <div className="grid gap-3">
                  <input
                    value={selected.first_name}
                    onChange={(e) => setSelected({ ...selected, first_name: e.target.value })}
                    className="rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="Jméno"
                    disabled={!canWrite}
                  />
                  <input
                    value={selected.last_name}
                    onChange={(e) => setSelected({ ...selected, last_name: e.target.value })}
                    className="rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="Příjmení"
                    disabled={!canWrite}
                  />
                  <input
                    type="email"
                    value={selected.email}
                    onChange={(e) => setSelected({ ...selected, email: e.target.value })}
                    className="rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="E-mail"
                    disabled={!canWrite}
                  />
                  <input
                    value={selected.phone ?? ""}
                    onChange={(e) => setSelected({ ...selected, phone: e.target.value })}
                    className="rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="Mobil"
                    disabled={!canWrite}
                  />
                  <select
                    value={selected.position_id ?? ""}
                    onChange={(e) =>
                      setSelected({
                        ...selected,
                        position_id: e.target.value ? parseInt(e.target.value, 10) : null,
                      })
                    }
                    className="rounded-lg border border-gray-300 px-3 py-2"
                    disabled={!canWrite}
                  >
                    <option value="">— Bez pozice —</option>
                    {positions.filter((p) => p.is_active !== 0).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selected.status}
                    onChange={(e) =>
                      setSelected({ ...selected, status: e.target.value as Application["status"] })
                    }
                    className="rounded-lg border border-gray-300 px-3 py-2"
                    disabled={!canWrite}
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={selected.notes ?? ""}
                    onChange={(e) => setSelected({ ...selected, notes: e.target.value })}
                    className="rounded-lg border border-gray-300 px-3 py-2"
                    rows={5}
                    placeholder="Poznámka"
                    disabled={!canWrite}
                  />
                  <div className="space-y-3">
                    {canWrite && (
                      <button
                        onClick={saveApplication}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
                      >
                        <Save className="h-4 w-4" />
                        Uložit změny
                      </button>
                    )}

                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="mb-2 text-sm font-medium text-gray-700">Přílohy (CV, dokumenty)</p>
                      {canWrite && (
                        <input
                          type="file"
                          onChange={(e) => uploadAttachment(e.target.files?.[0] ?? null)}
                          disabled={uploading}
                          className="mb-3 block w-full text-sm"
                        />
                      )}
                      <div className="space-y-2">
                        {attachments.map((f) => (
                          <div key={f.id} className="rounded border border-gray-200 p-2 text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <a className="truncate text-blue-700 hover:underline" href={f.file_path} target="_blank" rel="noreferrer">
                                {f.original_filename}
                              </a>
                              <div className="flex items-center gap-2">
                                {isPdf(f.mime_type) ? (
                                  <button
                                    onClick={() => setPdfPreviewId((prev) => (prev === f.id ? null : f.id))}
                                    className="rounded border border-gray-300 px-2 py-1 text-xs"
                                  >
                                    {pdfPreviewId === f.id ? "Skrýt náhled" : "Náhled PDF"}
                                  </button>
                                ) : null}
                                {canWrite ? (
                                  <button
                                    onClick={() => deleteAttachment(f.id)}
                                    className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700"
                                  >
                                    Smazat
                                  </button>
                                ) : null}
                              </div>
                            </div>
                            {isPdf(f.mime_type) && pdfPreviewId === f.id ? (
                              <iframe
                                title={`Náhled ${f.original_filename}`}
                                src={`${f.file_path}#view=FitH`}
                                className="mt-2 h-[420px] w-full rounded border border-gray-200"
                              />
                            ) : null}
                          </div>
                        ))}
                        {attachments.length === 0 && <p className="text-xs text-gray-500">Bez příloh.</p>}
                      </div>
                    </div>

                    {selected.details ? (
                      <details className="rounded-lg border border-gray-200 p-3" open>
                        <summary className="cursor-pointer text-sm font-semibold text-gray-800">Kompletní data dotazníku</summary>
                        <div className="mt-3 space-y-3 text-sm text-gray-700">
                          <div>
                            <p><strong>Titul:</strong> {selected.details.title || "-"}</p>
                            <p><strong>Datum narození:</strong> {selected.details.date_of_birth || "-"}</p>
                            <p><strong>Státní příslušnost:</strong> {selected.details.citizenship || "-"}</p>
                          </div>
                          <div>
                            <p><strong>Adresa:</strong>{" "}
                              {[
                                selected.details.correspondence_address?.street,
                                selected.details.correspondence_address?.number,
                                selected.details.correspondence_address?.city,
                                selected.details.correspondence_address?.zip,
                              ]
                                .filter(Boolean)
                                .join(", ") || "-"}
                            </p>
                          </div>
                          <div>
                            <p><strong>Vzdělání:</strong> {selected.details.education_level || "-"}</p>
                            <p><strong>Detail vzdělání:</strong> {selected.details.education_details || "-"}</p>
                            <p><strong>Kurzy:</strong> {selected.details.courses || "-"}</p>
                          </div>
                          <div>
                            <p><strong>Jazyky:</strong>{" "}
                              {[
                                `EN: ${selected.details.languages?.en || "-"}`,
                                `DE: ${selected.details.languages?.de || "-"}`,
                                `FR: ${selected.details.languages?.fr || "-"}`,
                                `RU: ${selected.details.languages?.ru || "-"}`,
                                `PL: ${selected.details.languages?.pl || "-"}`,
                              ].join(" | ")}
                            </p>
                            <p><strong>Další jazyky:</strong> {selected.details.languages?.other || "-"}</p>
                          </div>
                          <div>
                            <p><strong>Zaměstnavatel:</strong> {selected.details.employment?.employer_name || "-"}</p>
                            <p><strong>Sídlo:</strong> {selected.details.employment?.employer_address || "-"}</p>
                            <p><strong>Pozice a náplň:</strong> {selected.details.employment?.position_description || "-"}</p>
                          </div>
                          <div>
                            <p><strong>Typ práce:</strong> {selected.details.work_type || "-"}</p>
                            <p><strong>Možný nástup:</strong> {selected.details.possible_start || "-"}</p>
                            <p><strong>Doplňující poznámky:</strong> {selected.details.additional_notes || "-"}</p>
                          </div>
                          <div>
                            <p><strong>Souhlas:</strong> {selected.consent_given ? "Ano" : "Ne"}</p>
                            <p><strong>Datum souhlasu:</strong> {selected.consent_date ? new Date(selected.consent_date).toLocaleDateString("cs-CZ") : "-"}</p>
                          </div>
                          {selected.attachment_path ? (
                            <p>
                              <strong>Veřejná příloha:</strong>{" "}
                              <a
                                href={selected.attachment_path}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-700 hover:underline"
                              >
                                {selected.attachment_original_name || "Otevřít soubor"}
                              </a>
                            </p>
                          ) : null}
                        </div>
                      </details>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : tab === "positions" ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          {canWrite && (
            <div className="mb-4 flex gap-2">
              <input
                value={newPosition}
                onChange={(e) => setNewPosition(e.target.value)}
                placeholder="Nová pracovní pozice"
                className="rounded-lg border border-gray-300 px-3 py-2"
              />
              <button
                onClick={createPosition}
                className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
              >
                Přidat
              </button>
            </div>
          )}
          <div className="space-y-2">
            {positions.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 p-3">
                <input
                  value={p.name}
                  onChange={(e) => updatePosition(p, { name: e.target.value })}
                  disabled={!canWrite}
                  className="rounded-lg border border-gray-300 px-3 py-2"
                />
                {canWrite && (
                  <>
                    <button
                      onClick={() => updatePosition(p, { is_active: p.is_active ? 0 : 1 })}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      {p.is_active ? "Deaktivovat" : "Aktivovat"}
                    </button>
                    <button
                      onClick={() => removePosition(p.id)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                    >
                      Smazat
                    </button>
                  </>
                )}
              </div>
            ))}
            {positions.length === 0 && <p className="text-sm text-gray-500">Žádné pozice.</p>}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <input
              value={partTimerQuery}
              onChange={(e) => setPartTimerQuery(e.target.value)}
              placeholder="Hledat brigádníka..."
              className="rounded-lg border border-gray-300 px-3 py-2"
            />
            {canWrite && editingPartTimerId !== "new" && (
              <button
                onClick={startNewPartTimer}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                <Plus className="h-4 w-4" />
                Přidat brigádníka
              </button>
            )}
          </div>

          {editingPartTimerId !== null && canWrite && (
            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">
                  {editingPartTimerId === "new" ? "Nový brigádník" : `Úprava brigádníka #${editingPartTimerId}`}
                </h3>
                <button
                  onClick={cancelPartTimerEdit}
                  className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs"
                >
                  <X className="h-3.5 w-3.5" />
                  Zrušit
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={partTimerForm.first_name}
                  onChange={(e) => setPartTimerForm({ ...partTimerForm, first_name: e.target.value })}
                  placeholder="Jméno *"
                  className="rounded-lg border border-gray-300 px-3 py-2"
                />
                <input
                  value={partTimerForm.last_name}
                  onChange={(e) => setPartTimerForm({ ...partTimerForm, last_name: e.target.value })}
                  placeholder="Příjmení *"
                  className="rounded-lg border border-gray-300 px-3 py-2"
                />
                <input
                  type="tel"
                  value={partTimerForm.phone}
                  onChange={(e) => setPartTimerForm({ ...partTimerForm, phone: e.target.value })}
                  placeholder="Telefon"
                  className="rounded-lg border border-gray-300 px-3 py-2"
                />
                <input
                  type="email"
                  value={partTimerForm.email}
                  onChange={(e) => setPartTimerForm({ ...partTimerForm, email: e.target.value })}
                  placeholder="E-mail"
                  className="rounded-lg border border-gray-300 px-3 py-2"
                />
                <select
                  value={partTimerForm.status}
                  onChange={(e) =>
                    setPartTimerForm({ ...partTimerForm, status: e.target.value as PartTimerStatus })
                  }
                  className="rounded-lg border border-gray-300 px-3 py-2"
                >
                  {Object.entries(PART_TIMER_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <textarea
                  value={partTimerForm.notes}
                  onChange={(e) => setPartTimerForm({ ...partTimerForm, notes: e.target.value })}
                  placeholder="Poznámka"
                  rows={3}
                  className="rounded-lg border border-gray-300 px-3 py-2 sm:col-span-2"
                />
              </div>
              <div className="mt-3">
                <button
                  onClick={savePartTimer}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  <Save className="h-4 w-4" />
                  Uložit
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Jméno a příjmení</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Telefon</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">E-mail</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Stav</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Poznámka</th>
                  {canWrite && <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Akce</th>}
                </tr>
              </thead>
              <tbody>
                {partTimers.length === 0 ? (
                  <tr>
                    <td colSpan={canWrite ? 6 : 5} className="px-4 py-8 text-center text-gray-500">
                      Zatím žádní brigádníci
                    </td>
                  </tr>
                ) : (
                  partTimers.map((pt) => (
                    <tr key={pt.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {pt.last_name} {pt.first_name}
                      </td>
                      <td className="px-4 py-3 text-sm">{pt.phone || "-"}</td>
                      <td className="px-4 py-3 text-sm">{pt.email || "-"}</td>
                      <td className="px-4 py-3 text-sm">{PART_TIMER_STATUS_LABELS[pt.status]}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {pt.notes ? (
                          <span title={pt.notes} className="line-clamp-1 inline-block max-w-xs">
                            {pt.notes}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      {canWrite && (
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-2">
                            <button
                              onClick={() => startEditPartTimer(pt)}
                              className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Upravit
                            </button>
                            <button
                              onClick={() => removePartTimer(pt.id)}
                              className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Smazat
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
