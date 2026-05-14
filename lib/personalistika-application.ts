import { prisma } from "@/lib/db";
import {
  type CandidateApplicationDetails,
  type CandidateSource,
  normalizeCandidateSource,
} from "@/lib/personalistika-db";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export type ParsedApplicationForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  notes: string | null;
  source: CandidateSource;
  positionId: number | null;
  positionName: string | null;
  validFrom: Date | null;
  validTo: Date | null;
  consentGiven: number;
  consentDate: Date | null;
  details: CandidateApplicationDetails;
  attachmentPath: string | null;
  attachmentOriginalName: string | null;
  attachmentMime: string | null;
  attachmentSize: number | null;
};

export function buildDetailsFromFormData(formData: FormData): CandidateApplicationDetails {
  return {
    title: String(formData.get("title") ?? "").trim(),
    date_of_birth: String(formData.get("date_of_birth") ?? "").trim(),
    citizenship: String(formData.get("citizenship") ?? "").trim(),
    correspondence_address: {
      street: String(formData.get("address_street") ?? "").trim(),
      number: String(formData.get("address_number") ?? "").trim(),
      city: String(formData.get("address_city") ?? "").trim(),
      zip: String(formData.get("address_zip") ?? "").trim(),
    },
    education_level: String(formData.get("education_level") ?? "").trim(),
    education_details: String(formData.get("education_details") ?? "").trim(),
    courses: String(formData.get("courses") ?? "").trim(),
    languages: {
      en: String(formData.get("lang_en") ?? "").trim(),
      de: String(formData.get("lang_de") ?? "").trim(),
      fr: String(formData.get("lang_fr") ?? "").trim(),
      ru: String(formData.get("lang_ru") ?? "").trim(),
      pl: String(formData.get("lang_pl") ?? "").trim(),
      other: String(formData.get("lang_other") ?? "").trim(),
    },
    employment: {
      employer_name: String(formData.get("employer_name") ?? "").trim(),
      employer_address: String(formData.get("employer_address") ?? "").trim(),
      position_description: String(formData.get("position_description") ?? "").trim(),
    },
    work_type: String(formData.get("work_type") ?? "").trim(),
    possible_start: String(formData.get("possible_start") ?? "").trim(),
    additional_notes: String(formData.get("additional_notes") ?? "").trim(),
  };
}

async function resolvePositionName(positionId: number | null): Promise<string | null> {
  if (!positionId) return null;
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT id, name FROM hr_positions WHERE id = ? AND is_active = 1 LIMIT 1`,
    positionId
  )) as { id: number; name: string }[];
  return rows[0]?.name ?? null;
}

export async function savePublicAttachment(
  formData: FormData
): Promise<{
  attachmentPath: string | null;
  attachmentOriginalName: string | null;
  attachmentMime: string | null;
  attachmentSize: number | null;
  error?: string;
}> {
  const attachment = formData.get("attachment");
  if (!(attachment instanceof File) || attachment.size === 0) {
    return {
      attachmentPath: null,
      attachmentOriginalName: null,
      attachmentMime: null,
      attachmentSize: null,
    };
  }

  if (attachment.size > MAX_ATTACHMENT_BYTES) {
    return {
      attachmentPath: null,
      attachmentOriginalName: null,
      attachmentMime: null,
      attachmentSize: null,
      error: "Příloha je větší než 20 MB.",
    };
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "personalistika-public");
  await mkdir(uploadDir, { recursive: true });
  const ext = path.extname(attachment.name) || ".bin";
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 12)}${ext}`;
  const diskPath = path.join(uploadDir, safeName);
  const webPath = `/uploads/personalistika-public/${safeName}`;
  const buf = Buffer.from(await attachment.arrayBuffer());
  await writeFile(diskPath, buf);

  return {
    attachmentPath: webPath,
    attachmentOriginalName: attachment.name.slice(0, 255),
    attachmentMime: (attachment.type || "application/octet-stream").slice(0, 100),
    attachmentSize: buf.length,
  };
}

export async function parseApplicationFormData(
  formData: FormData,
  options: { defaultSource?: CandidateSource; requireConsent?: boolean } = {}
): Promise<{ data?: ParsedApplicationForm; error?: string }> {
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const emailValue = String(formData.get("email") ?? "").trim();
  const phoneValue = String(formData.get("phone") ?? "").trim();
  const notesValue = String(formData.get("notes") ?? "").trim();
  const sourceValue = normalizeCandidateSource(
    String(formData.get("source") ?? options.defaultSource ?? "web")
  );

  if (!firstName || !lastName || !emailValue) {
    return { error: "Vyplňte jméno, příjmení a e-mail." };
  }

  if (!EMAIL_REGEX.test(emailValue)) {
    return { error: "Neplatný e-mail." };
  }

  const positionIdRaw = String(formData.get("position_id") ?? "").trim();
  const parsedPositionId = !positionIdRaw ? null : parseInt(positionIdRaw, 10);
  const positionId = Number.isFinite(parsedPositionId) ? parsedPositionId : null;
  const positionName = await resolvePositionName(positionId);

  const validFromRaw = String(formData.get("valid_from") ?? "").trim();
  const validToRaw = String(formData.get("valid_to") ?? "").trim();
  const dateFrom = validFromRaw ? new Date(validFromRaw) : null;
  const dateTo = validToRaw ? new Date(validToRaw) : null;

  const requireConsent = options.requireConsent !== false;
  const consentGiven = String(formData.get("consent_given") ?? "") === "1" ? 1 : 0;
  const consentDateRaw = String(formData.get("consent_date") ?? "").trim();
  const consentDate = consentDateRaw ? new Date(consentDateRaw) : null;
  if (requireConsent && consentGiven !== 1) {
    return { error: "Je nutný souhlas se zpracováním údajů." };
  }

  const attachmentResult = await savePublicAttachment(formData);
  if (attachmentResult.error) {
    return { error: attachmentResult.error };
  }

  return {
    data: {
      firstName,
      lastName,
      email: emailValue,
      phone: phoneValue || null,
      notes: notesValue || null,
      source: sourceValue,
      positionId,
      positionName,
      validFrom: dateFrom,
      validTo: dateTo,
      consentGiven,
      consentDate,
      details: buildDetailsFromFormData(formData),
      attachmentPath: attachmentResult.attachmentPath,
      attachmentOriginalName: attachmentResult.attachmentOriginalName,
      attachmentMime: attachmentResult.attachmentMime,
      attachmentSize: attachmentResult.attachmentSize,
    },
  };
}

export async function insertCandidateApplication(
  data: ParsedApplicationForm,
  meta: {
    ipAddress?: string | null;
    userAgent?: string | null;
    submittedByUserId?: number | null;
  } = {}
): Promise<number> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO hr_candidate_applications
    (first_name, last_name, email, phone, position_id, position_name, notes, status, source, valid_from, valid_to, submitted_by_user_id, ip_address, user_agent, details_json, consent_given, consent_date, attachment_path, attachment_original_name, attachment_mime, attachment_size)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    data.firstName,
    data.lastName,
    data.email,
    data.phone,
    data.positionId,
    data.positionName,
    data.notes,
    data.source,
    data.validFrom,
    data.validTo,
    meta.submittedByUserId ?? null,
    meta.ipAddress ?? null,
    meta.userAgent ?? null,
    JSON.stringify(data.details),
    data.consentGiven,
    data.consentDate,
    data.attachmentPath,
    data.attachmentOriginalName,
    data.attachmentMime,
    data.attachmentSize
  );

  const idRows = (await prisma.$queryRawUnsafe(
    `SELECT id
     FROM hr_candidate_applications
     WHERE email = ? AND first_name = ? AND last_name = ?
     ORDER BY id DESC
     LIMIT 1`,
    data.email,
    data.firstName,
    data.lastName
  )) as { id: number }[];

  return idRows[0]?.id ?? 0;
}
