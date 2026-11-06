"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Save, Plus, Trash2, Pencil, X, Eye, Printer, UserCheck } from "lucide-react";
import Link from "next/link";
import { PersonalistikaQuestionnaireForm } from "@/components/personalistika/PersonalistikaQuestionnaireForm";
import {
  EmployeeForm,
  EMPTY_EMPLOYEE_FORM,
  type EmployeeEquipment,
  type EmployeeFormState,
} from "@/components/personalistika/EmployeeForm";
import { PersonalistikaOverviewPanel } from "@/components/personalistika/PersonalistikaOverviewPanel";
import { PersonalistikaPartTimersPanel } from "@/components/personalistika/PersonalistikaPartTimersPanel";
import {
  ApplicationFilterPanel,
  EMPTY_APPLICATION_FILTERS,
  type ApplicationFilters,
  type ApplicationFilterOptions,
} from "@/components/personalistika/ApplicationFilterPanel";
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
  position_id: number | null;
  department_id: number | null;
  employment_type: EmploymentType;
  start_date: string | null;
  end_date: string | null;
  status: EmployeeStatus;
  notes: string | null;
  onboarding?: ChecklistMap;
  offboarding?: ChecklistMap;
  onboarding_progress?: { done: number; total: number };
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

type FilterOptions = ApplicationFilterOptions;

export function PersonalistikaClient({ canWrite }: { canWrite: boolean }) {
  const [tab, setTab] = useState<
    "overview" | "applications" | "questionnaire" | "positions" | "part_timers" | "employees"
  >("overview");
  const [applications, setApplications] = useState<Application[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [draftFilters, setDraftFilters] = useState<ApplicationFilters>(EMPTY_APPLICATION_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<ApplicationFilters>(EMPTY_APPLICATION_FILTERS);
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
  const [hiringApplication, setHiringApplication] = useState(false);
  const [hireEmploymentType, setHireEmploymentType] = useState<EmploymentType>("thp");
  const [hireStartDate, setHireStartDate] = useState("");
  const [hiredEmployeeId, setHiredEmployeeId] = useState<number | null>(null);

  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState<"all" | EmployeeStatus>("active");
  const [employeePage, setEmployeePage] = useState(1);
  const [employeePagination, setEmployeePagination] = useState({ page: 1, pageSize: 50, total: 0 });
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

  const loadDepartments = async () => {
    const res = await fetch("/api/departments");
    const data = await res.json().catch(() => ([]));
    setDepartments(Array.isArray(data) ? data : data.departments ?? []);
  };

  const loadEmployees = async () => {
    const params = new URLSearchParams();
    if (employeeQuery) params.set("q", employeeQuery);
    if (employeeStatusFilter !== "all") params.set("status", employeeStatusFilter);
    params.set("page", String(employeePage));
    params.set("pageSize", "50");
    const res = await fetch(`/api/personalistika/employees?${params}`);
    const data = await res.json().catch(() => ({}));
    setEmployees(data.employees ?? []);
    if (data.pagination) {
      setEmployeePagination(data.pagination);
    }
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
    loadDepartments();
  }, []);

  useEffect(() => {
    if (tab === "employees") {
      loadEmployees();
    }
  }, [tab, employeeQuery, employeeStatusFilter, employeePage]);

  useEffect(() => {
    setEmployeePage(1);
  }, [employeeQuery, employeeStatusFilter]);

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
      setHiredEmployeeId(null);
      setHireStartDate("");
      setHireEmploymentType("thp");
      const res = await fetch(`/api/personalistika/applications/${selected.id}`);
      const data = await res.json().catch(() => ({}));
      if (data.application) {
        setSelected((prev) => (prev && prev.id === data.application.id ? { ...prev, ...data.application } : prev));
      }
      if (data.employee_id) {
        setHiredEmployeeId(Number(data.employee_id));
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
    if (!selected || fileId < 0) return;
    const res = await fetch(`/api/personalistika/applications/${selected.id}/attachments/${fileId}`, {
      method: "DELETE",
    });
    if (!res.ok) return;
    setAttachments((prev) => prev.filter((x) => x.id !== fileId));
  };

  const isPdf = (mime: string) => mime.trim().toLowerCase() === "application/pdf";

  const hireSelectedApplication = async () => {
    if (!selected) return;
    if (!confirm(`Přijmout ${selected.last_name} ${selected.first_name} jako zaměstnance?`)) return;
    setHiringApplication(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/personalistika/applications/${selected.id}/hire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employment_type: hireEmploymentType,
          start_date: hireStartDate || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Přijetí se nezdařilo.");
        return;
      }
      setHiredEmployeeId(Number(data.employee_id) || null);
      setSelected({ ...selected, status: "accepted" });
      const mailNote =
        data.already_hired
          ? " Uchazeč už byl přijat dříve."
          : data.activation_emailed === true
            ? " Aktivační e-mail byl odeslán."
            : data.user_created
              ? " Aktivační e-mail se nepodařilo odeslat — nastavte heslo v administraci."
              : " Napojeno na existující účet.";
      setSuccess(`Zaměstnanec #${data.employee_id} je připraven.${mailNote}`);
      await loadApplications();
    } finally {
      setHiringApplication(false);
    }
  };

  const mapEmployeeToForm = (e: EmployeeListItem): EmployeeFormState => ({
    first_name: e.first_name,
    last_name: e.last_name,
    email: e.email,
    phone: e.phone ?? "",
    personal_phone: e.personal_phone ?? "",
    personal_email: e.personal_email ?? "",
    position_title: e.position_title ?? "",
    position_id: e.position_id ?? null,
    department_id: e.department_id ?? null,
    employment_type: e.employment_type,
    start_date: e.start_date ?? "",
    end_date: e.end_date ?? "",
    status: e.status,
    notes: e.notes ?? "",
    onboarding: e.onboarding ?? {},
    offboarding: e.offboarding ?? {},
  });

  const openEmployeeById = async (id: number, mode: "view" | "edit" = "view") => {
    setTab("employees");
    setEditingEmployeeId(id);
    setEmployeePanelMode(mode);
    setError("");
    setSuccess("");
    const res = await fetch(`/api/personalistika/employees/${id}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.employee) {
      const e = data.employee as EmployeeListItem;
      setEmployeeUserId(e.user_id);
      setEmployeeForm(mapEmployeeToForm(e));
      setEmployeeEquipment(data.equipment ?? []);
    }
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
    setEmployeeForm(mapEmployeeToForm(emp));
    setEmployeeEquipment([]);
    setError("");
    setSuccess("");
    const res = await fetch(`/api/personalistika/employees/${emp.id}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.employee) {
      const e = data.employee as EmployeeListItem;
      setEmployeeUserId(e.user_id);
      setEmployeeForm(mapEmployeeToForm(e));
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
      if (!isNew) {
        setSuccess("Zaměstnanec byl uložen.");
      }
      if (isNew) {
        const mailNote =
          data.activation_emailed === true
            ? " Aktivační e-mail byl odeslán."
            : data.user_created
              ? " Aktivační e-mail se nepodařilo odeslat."
              : "";
        setSuccess(
          (data.user_created
            ? "Zaměstnanec byl založen včetně uživatelského účtu."
            : "Zaměstnanec byl založen a napojen na existující účet.") + mailNote
        );
        cancelEmployeeEdit();
      } else if (data.employee) {
        const e = data.employee as EmployeeListItem;
        setEmployeeUserId(e.user_id);
        setEmployeeForm(mapEmployeeToForm(e));
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
          <p className="mt-1 text-gray-600">
            Nábor → přijetí → nástup → provoz → výstup. Dotazníky, zaměstnanci, brigádníci a pozice.
          </p>
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      <div className="mb-4 flex flex-wrap rounded-lg border border-gray-200 bg-white p-1 w-fit gap-1">
        <button type="button" onClick={() => setTab("overview")} className={`rounded-md px-4 py-2 text-sm ${tab === "overview" ? "bg-gray-100 font-medium" : ""}`}>Přehled</button>
        <button type="button" onClick={() => setTab("employees")} className={`rounded-md px-4 py-2 text-sm ${tab === "employees" ? "bg-gray-100 font-medium" : ""}`}>Zaměstnanci</button>
        <button type="button" onClick={() => setTab("applications")} className={`rounded-md px-4 py-2 text-sm ${tab === "applications" ? "bg-gray-100 font-medium" : ""}`}>Dotazníky</button>
        {canWrite && (
          <button type="button" onClick={() => setTab("questionnaire")} className={`rounded-md px-4 py-2 text-sm ${tab === "questionnaire" ? "bg-gray-100 font-medium" : ""}`}>Vyplnit dotazník</button>
        )}
        <button type="button" onClick={() => setTab("positions")} className={`rounded-md px-4 py-2 text-sm ${tab === "positions" ? "bg-gray-100 font-medium" : ""}`}>Pracovní pozice</button>
        <button type="button" onClick={() => setTab("part_timers")} className={`rounded-md px-4 py-2 text-sm ${tab === "part_timers" ? "bg-gray-100 font-medium" : ""}`}>Brigádníci</button>
      </div>

      {tab === "overview" ? (
        <PersonalistikaOverviewPanel
          onOpenEmployee={(id) => openEmployeeById(id, "view")}
          onOpenApplications={(status) => {
            setTab("applications");
            if (status) {
              const next = { ...EMPTY_APPLICATION_FILTERS, status };
              setDraftFilters(next);
              setAppliedFilters(next);
            }
          }}
        />
      ) : tab === "questionnaire" && canWrite ? (
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

                    {canWrite && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 space-y-2">
                        <p className="text-sm font-medium text-emerald-900">Přijmout jako zaměstnance</p>
                        <p className="text-xs text-emerald-800">
                          Předvyplní evidenci, založí/napojí účet a odešle aktivační e-mail (místo pevného hesla).
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <select
                            value={hireEmploymentType}
                            onChange={(e) =>
                              setHireEmploymentType(e.target.value === "delnik" ? "delnik" : "thp")
                            }
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          >
                            <option value="thp">THP</option>
                            <option value="delnik">Dělnická</option>
                          </select>
                          <input
                            type="date"
                            value={hireStartDate}
                            onChange={(e) => setHireStartDate(e.target.value)}
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            title="Datum nástupu"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={hireSelectedApplication}
                            disabled={hiringApplication}
                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
                          >
                            <UserCheck className="h-4 w-4" />
                            {hiringApplication
                              ? "Přijímám…"
                              : selected.status === "accepted"
                                ? "Znovu otevřít / zkontrolovat přijetí"
                                : "Přijmout"}
                          </button>
                          {(hiredEmployeeId || selected.status === "accepted") && (
                            <button
                              type="button"
                              onClick={() => {
                                if (hiredEmployeeId) openEmployeeById(hiredEmployeeId, "edit");
                                else setTab("employees");
                              }}
                              className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm text-emerald-900"
                            >
                              Otevřít zaměstnance
                            </button>
                          )}
                        </div>
                      </div>
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
                                {canWrite && f.id > 0 ? (
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
                positions={positions}
                departments={departments}
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
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Checklist</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Stav</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Akce</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      Zatím žádní zaměstnanci
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => {
                    const prog = emp.onboarding_progress;
                    const complete = prog && prog.done >= prog.total && prog.total > 0;
                    return (
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
                      <td className="px-4 py-3 text-sm">
                        {prog ? (
                          <span className={complete ? "text-emerald-700" : "text-amber-700"}>
                            {prog.done}/{prog.total}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
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
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {employeePagination.total > employeePagination.pageSize && (
            <div className="flex items-center justify-between gap-3 text-sm text-gray-600">
              <span>
                Strana {employeePagination.page} · celkem {employeePagination.total}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={employeePage <= 1}
                  onClick={() => setEmployeePage((p) => Math.max(1, p - 1))}
                  className="rounded border border-gray-300 px-3 py-1 disabled:opacity-50"
                >
                  Předchozí
                </button>
                <button
                  type="button"
                  disabled={employeePage * employeePagination.pageSize >= employeePagination.total}
                  onClick={() => setEmployeePage((p) => p + 1)}
                  className="rounded border border-gray-300 px-3 py-1 disabled:opacity-50"
                >
                  Další
                </button>
              </div>
            </div>
          )}
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
        <PersonalistikaPartTimersPanel
          canWrite={canWrite}
          positions={positions}
          onError={setError}
          onSuccess={setSuccess}
          onHiredEmployee={(id) => openEmployeeById(id, "edit")}
        />
      )}
    </>
  );
}

