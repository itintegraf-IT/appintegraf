"use client";

import { useEffect, useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";

type Position = { id: number; name: string; is_active: number };
type LanguageKey = "lang_en" | "lang_de" | "lang_fr" | "lang_ru" | "lang_pl";

export const EMPTY_QUESTIONNAIRE_FORM = {
  title: "",
  first_name: "",
  last_name: "",
  date_of_birth: "",
  citizenship: "",
  address_street: "",
  address_number: "",
  address_city: "",
  address_zip: "",
  email: "",
  phone: "",
  position_id: "",
  notes: "",
  valid_from: "",
  valid_to: "",
  education_level: "Zakladni skola",
  education_details: "",
  courses: "",
  lang_en: "neumim",
  lang_de: "neumim",
  lang_fr: "neumim",
  lang_ru: "neumim",
  lang_pl: "neumim",
  lang_other: "",
  employer_name: "",
  employer_address: "",
  position_description: "",
  work_type: "zamestnani",
  possible_start: "",
  additional_notes: "",
  source: "kiosk",
  consent_given: true,
  consent_date: new Date().toISOString().slice(0, 10),
  website: "",
};

type FormState = typeof EMPTY_QUESTIONNAIRE_FORM;

type Props = {
  mode: "public" | "internal";
  positionsEndpoint?: string;
  submitEndpoint: string;
  onSuccess?: (message: string) => void;
  showHeader?: boolean;
  enableCvExtract?: boolean;
};

export function PersonalistikaQuestionnaireForm({
  mode,
  positionsEndpoint,
  submitEndpoint,
  onSuccess,
  showHeader = false,
  enableCvExtract = false,
}: Props) {
  const cvPdfInputRef = useRef<HTMLInputElement>(null);
  const [extractLoading, setExtractLoading] = useState(false);
  const [extractInfo, setExtractInfo] = useState<string | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<FormState>({
    ...EMPTY_QUESTIONNAIRE_FORM,
    source: mode === "internal" ? "internal" : "kiosk",
  });
  const [attachment, setAttachment] = useState<File | null>(null);

  const resolvedPositionsEndpoint =
    positionsEndpoint ??
    (mode === "internal" ? "/api/personalistika/positions" : "/api/public/personalistika/positions");

  const setLanguageLevel = (key: LanguageKey, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const applyExtractedCv = (ex: Record<string, unknown>) => {
    setForm((prev) => ({
      ...prev,
      ...(ex.title ? { title: String(ex.title) } : {}),
      ...(ex.first_name ? { first_name: String(ex.first_name) } : {}),
      ...(ex.last_name ? { last_name: String(ex.last_name) } : {}),
      ...(ex.date_of_birth ? { date_of_birth: String(ex.date_of_birth).slice(0, 10) } : {}),
      ...(ex.citizenship ? { citizenship: String(ex.citizenship) } : {}),
      ...(ex.address_street ? { address_street: String(ex.address_street) } : {}),
      ...(ex.address_number ? { address_number: String(ex.address_number) } : {}),
      ...(ex.address_city ? { address_city: String(ex.address_city) } : {}),
      ...(ex.address_zip ? { address_zip: String(ex.address_zip) } : {}),
      ...(ex.email ? { email: String(ex.email) } : {}),
      ...(ex.phone ? { phone: String(ex.phone) } : {}),
      ...(ex.position_id != null ? { position_id: String(ex.position_id) } : {}),
      ...(ex.education_level ? { education_level: String(ex.education_level) } : {}),
      ...(ex.education_details ? { education_details: String(ex.education_details) } : {}),
      ...(ex.courses ? { courses: String(ex.courses) } : {}),
      ...(ex.lang_en ? { lang_en: String(ex.lang_en) } : {}),
      ...(ex.lang_de ? { lang_de: String(ex.lang_de) } : {}),
      ...(ex.lang_fr ? { lang_fr: String(ex.lang_fr) } : {}),
      ...(ex.lang_ru ? { lang_ru: String(ex.lang_ru) } : {}),
      ...(ex.lang_pl ? { lang_pl: String(ex.lang_pl) } : {}),
      ...(ex.lang_other ? { lang_other: String(ex.lang_other) } : {}),
      ...(ex.employer_name ? { employer_name: String(ex.employer_name) } : {}),
      ...(ex.employer_address ? { employer_address: String(ex.employer_address) } : {}),
      ...(ex.position_description ? { position_description: String(ex.position_description) } : {}),
      ...(ex.work_type ? { work_type: String(ex.work_type) } : {}),
      ...(ex.possible_start ? { possible_start: String(ex.possible_start) } : {}),
      ...(ex.additional_notes ? { additional_notes: String(ex.additional_notes) } : {}),
      ...(ex.notes ? { notes: String(ex.notes) } : {}),
    }));
  };

  const handleExtractFromCv = async () => {
    const file = cvPdfInputRef.current?.files?.[0];
    if (!file) {
      setError("Vyberte soubor PDF životopisu.");
      return;
    }
    setError("");
    setExtractInfo(null);
    setExtractLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/personalistika/applications/extract-from-cv", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const hint = typeof data.hint === "string" ? ` ${data.hint}` : "";
        throw new Error(
          (typeof data.error === "string" ? data.error : "Vytěžení CV selhalo.") + hint
        );
      }
      applyExtractedCv((data.extracted ?? {}) as Record<string, unknown>);
      const meta = data.meta as {
        model?: string;
        provider?: string;
        pageCount?: number;
        textLength?: number;
        usedFallback?: boolean;
      } | undefined;
      const parts = [
        "Pole formuláře byla doplněna návrhem z AI – zkontrolujte je před uložením (včetně souhlasu GDPR).",
        meta?.usedFallback
          ? `Použita záložní služba (${meta?.provider ?? "Gemini"}), protože primární Groq neodpověděl.`
          : null,
        meta?.provider && meta?.model ? `Poskytovatel: ${meta.provider}, model: ${meta.model}.` : null,
        meta?.pageCount != null ? `Stran PDF: ${meta.pageCount}.` : null,
        meta?.textLength != null ? `Délka textu: ${meta.textLength} znaků.` : null,
      ].filter(Boolean);
      setExtractInfo(parts.join(" "));
      if (cvPdfInputRef.current) cvPdfInputRef.current.value = "";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba při vytěžování CV.");
    } finally {
      setExtractLoading(false);
    }
  };

  useEffect(() => {
    fetch(resolvedPositionsEndpoint)
      .then((r) => r.json())
      .then((data) => setPositions((data.positions ?? []) as Position[]))
      .catch(() => setPositions([]));
  }, [resolvedPositionsEndpoint]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const body = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      if (typeof v === "boolean") body.append(k, v ? "1" : "0");
      else body.append(k, v);
    });
    if (attachment) body.append("attachment", attachment);

    const res = await fetch(submitEndpoint, { method: "POST", body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Formulář se nepodařilo odeslat.");
      setLoading(false);
      return;
    }

    const message = data.message ?? "Formulář byl odeslán.";
    setSuccess(message);
    setLoading(false);
    setForm({
      ...EMPTY_QUESTIONNAIRE_FORM,
      source: mode === "internal" ? "internal" : "kiosk",
      consent_date: new Date().toISOString().slice(0, 10),
    });
    setAttachment(null);
    onSuccess?.(message);
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      {showHeader && (
        <p className="mb-4 text-sm text-gray-600">Rozšířený dotazník uchazeče. Sekce lze rozbalit/sbalit.</p>
      )}
      {error && <FormAlert type="error" message={error} />}
      {success && <FormAlert type="success" message={success} />}
      {extractInfo && (
        <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{extractInfo}</div>
      )}

      {enableCvExtract && (
        <div className="mb-6 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
          <h2 className="text-base font-medium text-gray-900">Návrh z CV (AI / Groq)</h2>
          <p className="mt-1 text-sm text-gray-600">
            Nahrajte textové PDF životopisu. Údaje se doplní jako návrh (Groq, při výpadku automaticky Gemini).
          </p>
          <CvExtractRow
            cvPdfInputRef={cvPdfInputRef}
            extractLoading={extractLoading}
            onExtract={handleExtractFromCv}
          />
        </div>
      )}

      {mode === "public" && (
        <input
          type="text"
          value={form.website}
          onChange={(e) => setForm((prev) => ({ ...prev, website: e.target.value }))}
          autoComplete="off"
          className="hidden"
          tabIndex={-1}
        />
      )}

      <div className="space-y-4">
        <details open className="rounded-lg border border-gray-200 p-4">
          <summary className="cursor-pointer font-semibold text-gray-900">Personální údaje</summary>
          <PersonalFields form={form} setForm={setForm} />
        </details>

        <details open className="rounded-lg border border-gray-200 p-4">
          <summary className="cursor-pointer font-semibold text-gray-900">Korespondenční adresa</summary>
          <AddressFields form={form} setForm={setForm} />
        </details>

        <details open className="rounded-lg border border-gray-200 p-4">
          <summary className="cursor-pointer font-semibold text-gray-900">Kontakt</summary>
          <ContactFields form={form} setForm={setForm} />
        </details>

        <details open className="rounded-lg border border-gray-200 p-4">
          <summary className="cursor-pointer font-semibold text-gray-900">Vzdělání</summary>
          <EducationFields form={form} setForm={setForm} />
        </details>

        <details open className="rounded-lg border border-gray-200 p-4">
          <summary className="cursor-pointer font-semibold text-gray-900">Jazykové vybavení</summary>
          <LanguageFields form={form} setForm={setForm} setLanguageLevel={setLanguageLevel} />
        </details>

        <details open className="rounded-lg border border-gray-200 p-4">
          <summary className="cursor-pointer font-semibold text-gray-900">Současné nebo poslední zaměstnání</summary>
          <EmploymentFields form={form} setForm={setForm} />
        </details>

        <details open className="rounded-lg border border-gray-200 p-4">
          <summary className="cursor-pointer font-semibold text-gray-900">Hledaná pracovní pozice</summary>
          <PositionFields form={form} setForm={setForm} positions={positions} mode={mode} />
        </details>

        <details open className="rounded-lg border border-gray-200 p-4">
          <summary className="cursor-pointer font-semibold text-gray-900">Příloha (Word, Excel, PDF, JPG)</summary>
          <div className="mt-3">
            <input type="file" onChange={(e) => setAttachment(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
          </div>
        </details>

        <details open className="rounded-lg border border-gray-200 p-4">
          <summary className="cursor-pointer font-semibold text-gray-900">Doplňující informace / Poznámky</summary>
          <NotesFields form={form} setForm={setForm} />
        </details>

        <details open className="rounded-lg border border-gray-200 p-4">
          <summary className="cursor-pointer font-semibold text-gray-900">Souhlas se zpracováním údajů</summary>
          <ConsentFields form={form} setForm={setForm} />
        </details>
      </div>

      <div className="mt-6">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-red-600 px-6 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? "Odesílám…" : "Odeslat dotazník"}
        </button>
      </div>
    </form>
  );
}

function FormAlert({ type, message }: { type: "error" | "success"; message: string }) {
  const cls = type === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700";
  return <div className={`mb-4 rounded-lg p-3 text-sm ${cls}`}>{message}</div>;
}

function PersonalFields({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Titul" className="rounded-lg border border-gray-300 px-3 py-2" />
      <input required value={form.first_name} onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))} placeholder="Jméno *" className="rounded-lg border border-gray-300 px-3 py-2" />
      <input required value={form.last_name} onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))} placeholder="Příjmení *" className="rounded-lg border border-gray-300 px-3 py-2" />
      <input type="date" value={form.date_of_birth} onChange={(e) => setForm((p) => ({ ...p, date_of_birth: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2" />
      <input value={form.citizenship} onChange={(e) => setForm((p) => ({ ...p, citizenship: e.target.value }))} placeholder="Státní příslušnost" className="rounded-lg border border-gray-300 px-3 py-2" />
    </div>
  );
}

function AddressFields({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <input value={form.address_street} onChange={(e) => setForm((p) => ({ ...p, address_street: e.target.value }))} placeholder="Ulice" className="rounded-lg border border-gray-300 px-3 py-2 sm:col-span-2" />
      <input value={form.address_number} onChange={(e) => setForm((p) => ({ ...p, address_number: e.target.value }))} placeholder="ČP" className="rounded-lg border border-gray-300 px-3 py-2" />
      <input value={form.address_city} onChange={(e) => setForm((p) => ({ ...p, address_city: e.target.value }))} placeholder="Město" className="rounded-lg border border-gray-300 px-3 py-2" />
      <input value={form.address_zip} onChange={(e) => setForm((p) => ({ ...p, address_zip: e.target.value }))} placeholder="PSČ" className="rounded-lg border border-gray-300 px-3 py-2" />
    </div>
  );
}

function ContactFields({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <input required type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="E-mail *" className="rounded-lg border border-gray-300 px-3 py-2 sm:col-span-2" />
      <input type="tel" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="Mobil" className="rounded-lg border border-gray-300 px-3 py-2" />
    </div>
  );
}

function EducationFields({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return <EducationFieldsBody form={form} setForm={setForm} />;
}

function EducationFieldsBody({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div className="mt-3 grid gap-3">
      <select value={form.education_level} onChange={(e) => setForm((p) => ({ ...p, education_level: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2 max-w-sm">
        <option value="Zakladni skola">Základní škola</option>
        <option value="Stredni odborne">Střední odborné</option>
        <option value="Maturita">Maturita</option>
        <option value="Vyssi odborne">Vyšší odborné</option>
        <option value="Vysokoskolske">Vysokoškolské</option>
      </select>
      <textarea rows={4} value={form.education_details} onChange={(e) => setForm((p) => ({ ...p, education_details: e.target.value }))} placeholder="Vzdělání (školy, obor, rok ukončení...)" className="rounded-lg border border-gray-300 px-3 py-2" />
      <textarea rows={3} value={form.courses} onChange={(e) => setForm((p) => ({ ...p, courses: e.target.value }))} placeholder="Rekvalifikace, kurzy, školení" className="rounded-lg border border-gray-300 px-3 py-2" />
    </div>
  );
}

function LanguageFields({
  form,
  setForm,
  setLanguageLevel,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  setLanguageLevel: (key: LanguageKey, value: string) => void;
}) {
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {(
        [
          ["lang_en", "Anglicky"],
          ["lang_de", "Německy"],
          ["lang_fr", "Francouzsky"],
          ["lang_ru", "Rusky"],
          ["lang_pl", "Polsky"],
        ] as const
      ).map(([key, label]) => (
        <div key={key}>
          <label className="mb-1 block text-sm text-gray-700">{label}</label>
          <select value={form[key]} onChange={(e) => setLanguageLevel(key, e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2">
            <option value="neumim">neumím</option>
            <option value="zaklad">základ</option>
            <option value="stredni">střední</option>
            <option value="pokrocily">pokročilý</option>
          </select>
        </div>
      ))}
      <textarea rows={3} value={form.lang_other} onChange={(e) => setForm((p) => ({ ...p, lang_other: e.target.value }))} placeholder="Další jazyky" className="rounded-lg border border-gray-300 px-3 py-2 sm:col-span-2" />
    </div>
  );
}

function EmploymentFields({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div className="mt-3 grid gap-3">
      <input value={form.employer_name} onChange={(e) => setForm((p) => ({ ...p, employer_name: e.target.value }))} placeholder="Název zaměstnavatele" className="rounded-lg border border-gray-300 px-3 py-2" />
      <input value={form.employer_address} onChange={(e) => setForm((p) => ({ ...p, employer_address: e.target.value }))} placeholder="Sídlo zaměstnavatele" className="rounded-lg border border-gray-300 px-3 py-2" />
      <textarea rows={4} value={form.position_description} onChange={(e) => setForm((p) => ({ ...p, position_description: e.target.value }))} placeholder="Pracovní pozice, náplň a pravomoci" className="rounded-lg border border-gray-300 px-3 py-2" />
    </div>
  );
}

function PositionFields({
  form,
  setForm,
  positions,
  mode,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  positions: Position[];
  mode: "public" | "internal";
}) {
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm text-gray-700">Typ práce</label>
        <div className="flex flex-wrap gap-4 text-sm">
          {[
            ["zamestnani", "Zaměstnání"],
            ["brigada", "Brigáda/Domácí práce"],
            ["praxe", "Praxe"],
          ].map(([value, label]) => (
            <label key={value} className="inline-flex items-center gap-2">
              <input type="radio" name="work_type" checked={form.work_type === value} onChange={() => setForm((p) => ({ ...p, work_type: value }))} />
              {label}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm text-gray-700">Zájem o pozici</label>
        <select value={form.position_id} onChange={(e) => setForm((p) => ({ ...p, position_id: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2">
          <option value="">— Volitelné —</option>
          {positions.filter((p) => p.is_active !== 0).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      {mode === "public" ? (
        <SourcePublic form={form} setForm={setForm} />
      ) : (
        <SourceInternal />
      )}
      <textarea rows={3} value={form.possible_start} onChange={(e) => setForm((p) => ({ ...p, possible_start: e.target.value }))} placeholder="Možný termín nástupu od data nabídky" className="rounded-lg border border-gray-300 px-3 py-2 sm:col-span-2" />
      <input type="date" value={form.valid_from} onChange={(e) => setForm((p) => ({ ...p, valid_from: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2" />
      <input type="date" value={form.valid_to} onChange={(e) => setForm((p) => ({ ...p, valid_to: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2" />
    </div>
  );
}

function SourcePublic({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-gray-700">Zdroj</label>
      <select value={form.source} onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2">
        <option value="kiosk">Kiosk</option>
        <option value="web">Web</option>
      </select>
    </div>
  );
}

function SourceInternal() {
  return (
    <div>
      <label className="mb-1 block text-sm text-gray-700">Zdroj</label>
      <input value="Interní (personalistika)" disabled className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600" />
    </div>
  );
}

function NotesFields({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div className="mt-3 grid gap-3">
      <textarea rows={4} value={form.additional_notes} onChange={(e) => setForm((p) => ({ ...p, additional_notes: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2" />
      <textarea rows={3} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Interní poznámka k podání (volitelné)" className="rounded-lg border border-gray-300 px-3 py-2" />
    </div>
  );
}

function CvExtractRow({
  cvPdfInputRef,
  extractLoading,
  onExtract,
}: {
  cvPdfInputRef: React.RefObject<HTMLInputElement | null>;
  extractLoading: boolean;
  onExtract: () => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <input
        ref={cvPdfInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="block max-w-md text-sm"
      />
      <button
        type="button"
        onClick={onExtract}
        disabled={extractLoading}
        className="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-50"
      >
        {extractLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
        {extractLoading ? "Vytěžuji…" : "Doplnit z CV"}
      </button>
    </div>
  );
}

function ConsentFields({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={form.consent_given} onChange={(e) => setForm((p) => ({ ...p, consent_given: e.target.checked }))} />
        Souhlasím se zpracováním osobních údajů
      </label>
      <input type="date" value={form.consent_date} onChange={(e) => setForm((p) => ({ ...p, consent_date: e.target.value }))} className="rounded-lg border border-gray-300 px-3 py-2" />
    </div>
  );
}
