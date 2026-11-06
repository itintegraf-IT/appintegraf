"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Save, Plus, Trash2, Pencil, X, Eye, Printer } from "lucide-react";
import Link from "next/link";
import { PersonalistikaQuestionnaireForm } from "@/components/personalistika/PersonalistikaQuestionnaireForm";
import {
  EmployeeForm,
  EMPTY_EMPLOYEE_FORM,
  type EmployeeEquipment,
  type EmployeeFormState,
} from "@/components/personalistika/EmployeeForm";
import type { ChecklistMap, EmploymentType, EmployeeStatus } from "@/lib/personalistika-employee-types";

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

type EmployeeListItem = {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  personal_phone: string | null;
  personal_email: string | null;
  position_title: string | null;
  employment_type: EmploymentType;
  start_date: string | null;
  end_date: string | null;
  status: EmployeeStatus;
  notes: string | null;
  onboarding?: ChecklistMap;
  offboarding?: ChecklistMap;
};

const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  thp: "THP",
  delnik: "Dělnická",
};

const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  active: "Aktivní",
  terminated: "Ukončený",
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

const WORK_TYPE_LABELS: Record<string, string> = {
  zamestnani: "Zaměstnání",
  brigada: "Brigáda",
  praxe: "Praxe",
};

type ApplicationFilters = {
  q: string;
  status: string;
  positionId: string;
  workType: string;
  educationLevel: string;
  city: string;
  datePreset: string;
  dateFrom: string;
};

const EMPTY_FILTERS: ApplicationFilters = {
  q: "",
  status: "all",
  positionId: "all",
  workType: "all",
  educationLevel: "all",
  city: "all",
  datePreset: "all",
  dateFrom: "",
};

type FilterOptions = {
  positions: Position[];
  cities: string[];
  educationLevels: { value: string; label: string }[];
  workTypes: { value: string; label: string }[];
  datePresets: { value: string; label: string }[];
};

export function PersonalistikaClient({ canWrite }: { canWrite: boolean }) {
  const [tab, setTab] = useState<"applications" | "questionnaire" | "positions" | "part_timers" | "employees">("employees");
  const [applications, setApplications] = useState<Application[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [draftFilters, setDraftFilters] = useState<ApplicationFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<ApplicationFilters>(EMPTY_FILTERS);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    positions: [],
    cities: [],
    educationLevels: [],
    workTypes: [],
    datePresets: [],
  });
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

  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState<"all" | EmployeeStatus>("active");
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | "new" | null>(null);
  const [employeePanelMode, setEmployeePanelMode] = useState<"view" | "edit" | "new">("view");
  const [employeeForm, setEmployeeForm] = useState<EmployeeFormState>(EMPTY_EMPLOYEE_FORM);
  const [employeeUserId, setEmployeeUserId] = useState<number | null>(null);
  const [employeeEquipment, setEmployeeEquipment] = useState<EmployeeEquipment[]>([]);
  const [savingEmployee, setSavingEmployee] = useState(false);

  const loadApplications = useCallback(async (filters: ApplicationFilters = appliedFilters) => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.positionId !== "all") params.set("position_id", filters.positionId);
    if (filters.workType !== "all") params.set("work_type", filters.workType);
    if (filters.educationLevel !== "all") params.set("education_level", filters.educationLevel);
    if (filters.city !== "all") params.set("city", filters.city);
    if (filters.datePreset !== "all") params.set("date_preset", filters.datePreset);
    if (filters.datePreset === "custom" && filters.dateFrom) params.set("date_from", filters.dateFrom);
    const res = await fetch(`/api/personalistika/applications?${params}`);
    const data = await res.json().catch(() => ({}));
    setApplications(data.applications ?? []);
  }, [appliedFilters]);

  const loadFilterOptions = async () => {
    const res = await fetch("/api/personalistika/applications/filter-options");
    const data = await res.json().catch(() => ({}));
    setFilterOptions({
      positions: data.positions ?? [],
      cities: data.cities ?? [],
      educationLevels: data.educationLevels ?? [],
      workTypes: data.workTypes ?? [],
      datePresets: data.datePresets ?? [],
    });
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

  const loadEmployees = async () => {
    const params = new URLSearchParams();
    if (employeeQuery) params.set("q", employeeQuery);
    if (employeeStatusFilter !== "all") params.set("status", employeeStatusFilter);
    const res = await fetch(`/api/personalistika/employees?${params}`);
    const data = await res.json().catch(() => ({}));
    setEmployees(data.employees ?? []);
    if (data.bootstrap && Number(data.bootstrap.created) > 0) {
      setSuccess(
        `Evidence zaměstnanců byla jednorázově naplněna z aktivních uživatelů (${data.bootstrap.created}).`
      );
    }
  };

  useEffect(() => {
    loadApplications(appliedFilters);
  }, [appliedFilters, loadApplications]);

  useEffect(() => {
    loadPositions();
    loadFilterOptions();
  }, []);

  useEffect(() => {
    if (tab === "part_timers") {
      loadPartTimers();
    }
  }, [tab, partTimerQuery]);

  useEffect(() => {
    if (tab === "employees") {
      loadEmployees();
    }
  }, [tab, employeeQuery, employeeStatusFilter]);

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

  const startNewEmployee = () => {
    setEditingEmployeeId("new");
    setEmployeePanelMode("new");
    setEmployeeForm(EMPTY_EMPLOYEE_FORM);
    setEmployeeUserId(null);
    setEmployeeEquipment([]);
    setError("");
    setSuccess("");
  };

  const openEmployeePanel = async (emp: EmployeeListItem, mode: "view" | "edit") => {
    setEditingEmployeeId(emp.id);
    setEmployeePanelMode(mode);
    setEmployeeUserId(emp.user_id);
    setEmployeeForm({
      first_name: emp.first_name,
      last_name: emp.last_name,
      email: emp.email,
      phone: emp.phone ?? "",
      personal_phone: emp.personal_phone ?? "",
      personal_email: emp.personal_email ?? "",
      position_title: emp.position_title ?? "",
      employment_type: emp.employment_type,
      start_date: emp.start_date ?? "",
      end_date: emp.end_date ?? "",
      status: emp.status,
      notes: emp.notes ?? "",
      onboarding: emp.onboarding ?? {},
      offboarding: emp.offboarding ?? {},
    });
    setEmployeeEquipment([]);
    setError("");
    setSuccess("");
    const res = await fetch(`/api/personalistika/employees/${emp.id}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.employee) {
      const e = data.employee as EmployeeListItem;
      setEmployeeUserId(e.user_id);
      setEmployeeForm({
        first_name: e.first_name,
        last_name: e.last_name,
        email: e.email,
        phone: e.phone ?? "",
        personal_phone: e.personal_phone ?? "",
        personal_email: e.personal_email ?? "",
        position_title: e.position_title ?? "",
        employment_type: e.employment_type,
        start_date: e.start_date ?? "",
        end_date: e.end_date ?? "",
        status: e.status,
        notes: e.notes ?? "",
        onboarding: e.onboarding ?? {},
        offboarding: e.offboarding ?? {},
      });
      setEmployeeEquipment(data.equipment ?? []);
    }
  };

  const cancelEmployeeEdit = () => {
    setEditingEmployeeId(null);
    setEmployeePanelMode("view");
    setEmployeeForm(EMPTY_EMPLOYEE_FORM);
    setEmployeeUserId(null);
    setEmployeeEquipment([]);
  };

  const saveEmployee = async () => {
    if (editingEmployeeId === null) return;
    setError("");
    setSuccess("");
    setSavingEmployee(true);

    const isNew = editingEmployeeId === "new";
    const url = isNew
      ? "/api/personalistika/employees"
      : `/api/personalistika/employees/${editingEmployeeId}`;
    const method = isNew ? "POST" : "PATCH";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(employeeForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Zaměstnance se nepodařilo uložit.");
        return;
      }
      setSuccess(
        isNew
          ? data.user_created
            ? "Zaměstnanec byl založen včetně uživatelského účtu."
            : "Zaměstnanec byl založen a napojen na existující účet."
          : "Zaměstnanec byl uložen."
      );
      if (isNew) {
        cancelEmployeeEdit();
      } else if (data.employee) {
        const e = data.employee as EmployeeListItem;
        setEmployeeUserId(e.user_id);
        setEmployeeForm({
          first_name: e.first_name,
          last_name: e.last_name,
          email: e.email,
          phone: e.phone ?? "",
          personal_phone: e.personal_phone ?? "",
          personal_email: e.personal_email ?? "",
          position_title: e.position_title ?? "",
          employment_type: e.employment_type,
          start_date: e.start_date ?? "",
          end_date: e.end_date ?? "",
          status: e.status,
          notes: e.notes ?? "",
          onboarding: e.onboarding ?? {},
          offboarding: e.offboarding ?? {},
        });
        setEmployeeEquipment(data.equipment ?? []);
      }
      await loadEmployees();
    } finally {
      setSavingEmployee(false);
    }
  };

  const removeEmployee = async (id: number) => {
    if (!confirm("Smazat evidenci zaměstnance? Uživatelský účet zůstane zachován.")) return;
    setError("");
    setSuccess("");
    const res = await fetch(`/api/personalistika/employees/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Smazání se nezdařilo.");
      return;
    }
    if (editingEmployeeId === id) cancelEmployeeEdit();
    await loadEmployees();
  };

  const employeeFormWritable = canWrite && employeePanelMode !== "view";

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <BriefcaseBusiness className="h-7 w-7 text-red-600" />
            Personalistika
          </h1>
          <p className="mt-1 text-gray-600">Dotazníky, zaměstnanci, brigádníci a pracovní pozice.</p>
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      <div className="mb-4 flex flex-wrap rounded-lg border border-gray-200 bg-white p-1 w-fit gap-1">
        <button type="button" onClick={() => setTab("employees")} className={`rounded-md px-4 py-2 text-sm ${tab === "employees" ? "bg-gray-100 font-medium" : ""}`}>Zaměstnanci</button>
        <button type="button" onClick={() => setTab("applications")} className={`rounded-md px-4 py-2 text-sm ${tab === "applications" ? "bg-gray-100 font-medium" : ""}`}>Dotazníky</button>
        {canWrite && (
          <button type="button" onClick={() => setTab("questionnaire")} className={`rounded-md px-4 py-2 text-sm ${tab === "questionnaire" ? "bg-gray-100 font-medium" : ""}`}>Vyplnit dotazník</button>
        )}
        <button type="button" onClick={() => setTab("positions")} className={`rounded-md px-4 py-2 text-sm ${tab === "positions" ? "bg-gray-100 font-medium" : ""}`}>Pracovní pozice</button>
        <button type="button" onClick={() => setTab("part_timers")} className={`rounded-md px-4 py-2 text-sm ${tab === "part_timers" ? "bg-gray-100 font-medium" : ""}`}>Brigádníci</button>
      </div>

      {tab === "questionnaire" && canWrite ? (
        <PersonalistikaQuestionnaireForm
          mode="internal"
          submitEndpoint="/api/personalistika/applications"
          enableCvExtract
          onSuccess={(message) => {
            setSuccess(message);
            setTab("applications");
            loadApplications(appliedFilters);
          }}
        />
      ) : tab === "applications" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <ApplicationFilterPanel
              draftFilters={draftFilters}
              setDraftFilters={setDraftFilters}
              setAppliedFilters={setAppliedFilters}
              filterOptions={filterOptions}
              statusOptions={statusOptions}
            />

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Uchazeč</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Pozice</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Město</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Typ práce</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Kontakt</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Stav</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
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
                        <td className="px-4 py-3 text-sm">{a.details?.correspondence_address?.city ?? "-"}</td>
                        <td className="px-4 py-3 text-sm">{WORK_TYPE_LABELS[a.details?.work_type ?? ""] ?? a.details?.work_type ?? "-"}</td>
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
      ) : tab === "employees" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-wrap gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Hledat</label>
                <input
                  value={employeeQuery}
                  onChange={(e) => setEmployeeQuery(e.target.value)}
                  placeholder="Jméno, e-mail…"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Stav</label>
                <select
                  value={employeeStatusFilter}
                  onChange={(e) =>
                    setEmployeeStatusFilter(
                      e.target.value === "terminated"
                        ? "terminated"
                        : e.target.value === "all"
                          ? "all"
                          : "active"
                    )
                  }
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="active">Aktivní</option>
                  <option value="terminated">Ukončení</option>
                  <option value="all">Všichni</option>
                </select>
              </div>
            </div>
            {canWrite && (
              <button
                type="button"
                onClick={startNewEmployee}
                className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                <Plus className="h-4 w-4" />
                Nový zaměstnanec
              </button>
            )}
          </div>

          {editingEmployeeId !== null && (
            <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-gray-900">
                  {editingEmployeeId === "new"
                    ? "Nový zaměstnanec"
                    : employeePanelMode === "view"
                      ? "Prohlížení zaměstnance"
                      : "Úprava zaměstnance"}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {editingEmployeeId !== "new" && typeof editingEmployeeId === "number" && (
                    <>
                      <Link
                        href={`/personalistika/protokol/nastup?employeeId=${editingEmployeeId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                      >
                        <Printer className="h-4 w-4" />
                        Nástupní protokol
                      </Link>
                      <Link
                        href={`/personalistika/protokol/vystup?employeeId=${editingEmployeeId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                      >
                        <Printer className="h-4 w-4" />
                        Výstupní protokol
                      </Link>
                    </>
                  )}
                  {employeePanelMode === "view" && canWrite && (
                    <button
                      type="button"
                      onClick={() => setEmployeePanelMode("edit")}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                    >
                      <Pencil className="h-4 w-4" />
                      Upravit
                    </button>
                  )}
                  {employeeFormWritable && (
                    <button
                      type="button"
                      onClick={saveEmployee}
                      disabled={savingEmployee}
                      className="inline-flex items-center gap-1 rounded-lg bg-gray-800 px-3 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-60"
                    >
                      <Save className="h-4 w-4" />
                      {savingEmployee ? "Ukládám…" : "Uložit"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={cancelEmployeeEdit}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    <X className="h-4 w-4" />
                    Zavřít
                  </button>
                </div>
              </div>
              <EmployeeForm
                form={employeeForm}
                setForm={setEmployeeForm}
                canWrite={employeeFormWritable}
                equipment={employeeEquipment}
                userId={employeeUserId}
                isNew={editingEmployeeId === "new"}
              />
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Zaměstnanec</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Typ</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Pozice</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Nástup</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Stav</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Akce</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      Zatím žádní zaměstnanci
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => (
                    <tr
                      key={emp.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 ${
                        editingEmployeeId === emp.id ? "bg-red-50/40" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => openEmployeePanel(emp, "view")}
                          className="text-left font-medium text-gray-900 hover:underline"
                        >
                          {emp.last_name} {emp.first_name}
                        </button>
                        <div className="text-xs text-gray-500">{emp.email}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">{EMPLOYMENT_TYPE_LABELS[emp.employment_type]}</td>
                      <td className="px-4 py-3 text-sm">{emp.position_title || "-"}</td>
                      <td className="px-4 py-3 text-sm">{emp.start_date || "-"}</td>
                      <td className="px-4 py-3 text-sm">{EMPLOYEE_STATUS_LABELS[emp.status]}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-2">
                          <button
                            type="button"
                            onClick={() => openEmployeePanel(emp, "view")}
                            className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Prohlížet
                          </button>
                          {canWrite && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEmployeePanel(emp, "edit")}
                                className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Upravit
                              </button>
                              <button
                                type="button"
                                onClick={() => removeEmployee(emp.id)}
                                className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Smazat
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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

function ApplicationFilterPanel({
  draftFilters,
  setDraftFilters,
  setAppliedFilters,
  filterOptions,
  statusOptions,
}: {
  draftFilters: ApplicationFilters;
  setDraftFilters: React.Dispatch<React.SetStateAction<ApplicationFilters>>;
  setAppliedFilters: React.Dispatch<React.SetStateAction<ApplicationFilters>>;
  filterOptions: FilterOptions;
  statusOptions: { value: string; label: string }[];
}) {
  const todayLabel = new Date().toLocaleDateString("cs-CZ");
  const selectCls = "w-full rounded-lg border border-gray-300 px-2 py-2 text-sm";
  const labelCls = "mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500";

  return (
    <div className="border-b border-gray-200 p-4">
      <p className="mb-3 text-sm font-medium text-gray-700">
        Přehled dotazníků uchazečů ke dni {todayLabel}
      </p>
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <div>
          <label className={labelCls}>Uchazeč</label>
          <input
            value={draftFilters.q}
            onChange={(e) => setDraftFilters((f) => ({ ...f, q: e.target.value }))}
            placeholder="Jméno, e-mail…"
            className={selectCls}
          />
        </div>
        <FilterSelect
          label="Pozice"
          value={draftFilters.positionId}
          onChange={(v) => setDraftFilters((f) => ({ ...f, positionId: v }))}
          options={[
            { value: "all", label: "Všechny" },
            ...filterOptions.positions.map((p) => ({ value: String(p.id), label: p.name })),
          ]}
        />
        <FilterSelect
          label="Poměr"
          value={draftFilters.workType}
          onChange={(v) => setDraftFilters((f) => ({ ...f, workType: v }))}
          options={filterOptions.workTypes.length ? filterOptions.workTypes : [{ value: "all", label: "Vše" }]}
        />
        <FilterSelect
          label="Vzdělání"
          value={draftFilters.educationLevel}
          onChange={(v) => setDraftFilters((f) => ({ ...f, educationLevel: v }))}
          options={filterOptions.educationLevels.length ? filterOptions.educationLevels : [{ value: "all", label: "Vše" }]}
        />
        <FilterSelect
          label="Město"
          value={draftFilters.city}
          onChange={(v) => setDraftFilters((f) => ({ ...f, city: v }))}
          options={[
            { value: "all", label: "Vše" },
            ...filterOptions.cities
              .filter((c) => c !== "all")
              .map((c) => ({ value: c, label: c })),
          ]}
        />
        <FilterSelect
          label="Období od"
          value={draftFilters.datePreset}
          onChange={(v) => setDraftFilters((f) => ({ ...f, datePreset: v }))}
          options={filterOptions.datePresets.length ? filterOptions.datePresets : [{ value: "all", label: "Vše" }]}
        />
      </div>
      {draftFilters.datePreset === "custom" && (
        <div className="mt-3 max-w-xs">
          <label className={labelCls}>Konkrétní datum</label>
          <input
            type="date"
            value={draftFilters.dateFrom}
            onChange={(e) => setDraftFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            className={selectCls}
          />
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <FilterSelect
          label="Stav"
          value={draftFilters.status}
          onChange={(v) => setDraftFilters((f) => ({ ...f, status: v }))}
          options={statusOptions}
          compact
        />
        <div className="flex gap-2 pt-4">
          <button
            type="button"
            onClick={() => setAppliedFilters({ ...draftFilters })}
            className="rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Filtruj
          </button>
          <button
            type="button"
            onClick={() => {
              setDraftFilters(EMPTY_FILTERS);
              setAppliedFilters(EMPTY_FILTERS);
            }}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Vymazat
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  compact,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  compact?: boolean;
}) {
  const labelCls = "mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500";
  return (
    <div className={compact ? "min-w-[140px]" : ""}>
      <label className={labelCls}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm">
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
