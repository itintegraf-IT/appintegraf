"use client";

export type ApplicationFilters = {
  q: string;
  status: string;
  positionId: string;
  workType: string;
  educationLevel: string;
  city: string;
  datePreset: string;
  dateFrom: string;
};

export const EMPTY_APPLICATION_FILTERS: ApplicationFilters = {
  q: "",
  status: "all",
  positionId: "all",
  workType: "all",
  educationLevel: "all",
  city: "all",
  datePreset: "all",
  dateFrom: "",
};

export type ApplicationFilterOptions = {
  positions: { id: number; name: string }[];
  cities: string[];
  educationLevels: { value: string; label: string }[];
  workTypes: { value: string; label: string }[];
  datePresets: { value: string; label: string }[];
};

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
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ApplicationFilterPanel({
  draftFilters,
  setDraftFilters,
  setAppliedFilters,
  filterOptions,
  statusOptions,
}: {
  draftFilters: ApplicationFilters;
  setDraftFilters: React.Dispatch<React.SetStateAction<ApplicationFilters>>;
  setAppliedFilters: React.Dispatch<React.SetStateAction<ApplicationFilters>>;
  filterOptions: ApplicationFilterOptions;
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
          options={
            filterOptions.workTypes.length ? filterOptions.workTypes : [{ value: "all", label: "Vše" }]
          }
        />
        <FilterSelect
          label="Vzdělání"
          value={draftFilters.educationLevel}
          onChange={(v) => setDraftFilters((f) => ({ ...f, educationLevel: v }))}
          options={
            filterOptions.educationLevels.length
              ? filterOptions.educationLevels
              : [{ value: "all", label: "Vše" }]
          }
        />
        <FilterSelect
          label="Město"
          value={draftFilters.city}
          onChange={(v) => setDraftFilters((f) => ({ ...f, city: v }))}
          options={[
            { value: "all", label: "Vše" },
            ...filterOptions.cities.filter((c) => c !== "all").map((c) => ({ value: c, label: c })),
          ]}
        />
        <FilterSelect
          label="Období od"
          value={draftFilters.datePreset}
          onChange={(v) => setDraftFilters((f) => ({ ...f, datePreset: v }))}
          options={
            filterOptions.datePresets.length
              ? filterOptions.datePresets
              : [{ value: "all", label: "Vše" }]
          }
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
              setDraftFilters(EMPTY_APPLICATION_FILTERS);
              setAppliedFilters(EMPTY_APPLICATION_FILTERS);
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
