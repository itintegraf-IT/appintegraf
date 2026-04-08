import { NextRequest, NextResponse } from "next/server";
import { getUsersWithModuleAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import {
  ensurePersonalistikaTables,
  normalizeCandidateSource,
} from "@/lib/personalistika-db";
import { logPersonalistikaAudit } from "@/lib/personalistika-audit";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 8;

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const existing = rateLimitStore.get(ip);
  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  if (existing.count >= MAX_REQUESTS_PER_WINDOW) return true;
  existing.count += 1;
  return false;
}

export async function POST(req: NextRequest) {
  try {
    await ensurePersonalistikaTables();
    const ip = getClientIp(req);
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: "Příliš mnoho požadavků, zkuste to za chvíli." }, { status: 429 });
    }

    const formData = await req.formData();
    const honeypot = String(formData.get("website") ?? "").trim();
    if (honeypot) {
      return NextResponse.json({ success: true, message: "Odesláno." });
    }

    const firstName = String(formData.get("first_name") ?? "").trim();
    const lastName = String(formData.get("last_name") ?? "").trim();
    const emailValue = String(formData.get("email") ?? "").trim();
    const phoneValue = String(formData.get("phone") ?? "").trim();
    const notesValue = String(formData.get("notes") ?? "").trim();
    const sourceValue = normalizeCandidateSource(String(formData.get("source") ?? "web"));

    if (!firstName || !lastName || !emailValue) {
      return NextResponse.json({ error: "Vyplňte jméno, příjmení a e-mail." }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailValue)) {
      return NextResponse.json({ error: "Neplatný e-mail." }, { status: 400 });
    }

    const positionIdRaw = String(formData.get("position_id") ?? "").trim();
    const parsedPositionId = !positionIdRaw ? null : parseInt(positionIdRaw, 10);
    const positionId = Number.isFinite(parsedPositionId) ? parsedPositionId : null;

    let positionName: string | null = null;
    if (positionId) {
      const rows = (await prisma.$queryRawUnsafe(
        `SELECT id, name FROM hr_positions WHERE id = ? AND is_active = 1 LIMIT 1`,
        positionId
      )) as { id: number; name: string }[];
      positionName = rows[0]?.name ?? null;
    }

    const validFromRaw = String(formData.get("valid_from") ?? "").trim();
    const validToRaw = String(formData.get("valid_to") ?? "").trim();
    const dateFrom = validFromRaw ? new Date(validFromRaw) : null;
    const dateTo = validToRaw ? new Date(validToRaw) : null;

    const consentGiven = String(formData.get("consent_given") ?? "") === "1" ? 1 : 0;
    const consentDateRaw = String(formData.get("consent_date") ?? "").trim();
    const consentDate = consentDateRaw ? new Date(consentDateRaw) : null;
    if (consentGiven !== 1) {
      return NextResponse.json({ error: "Je nutný souhlas se zpracováním údajů." }, { status: 400 });
    }

    let attachmentPath: string | null = null;
    let attachmentOriginalName: string | null = null;
    let attachmentMime: string | null = null;
    let attachmentSize: number | null = null;
    const attachment = formData.get("attachment");
    if (attachment instanceof File && attachment.size > 0) {
      const maxBytes = 20 * 1024 * 1024;
      if (attachment.size > maxBytes) {
        return NextResponse.json({ error: "Příloha je větší než 20 MB." }, { status: 400 });
      }
      const uploadDir = path.join(process.cwd(), "public", "uploads", "personalistika-public");
      await mkdir(uploadDir, { recursive: true });
      const ext = path.extname(attachment.name) || ".bin";
      const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 12)}${ext}`;
      const diskPath = path.join(uploadDir, safeName);
      const webPath = `/uploads/personalistika-public/${safeName}`;
      const buf = Buffer.from(await attachment.arrayBuffer());
      await writeFile(diskPath, buf);
      attachmentPath = webPath;
      attachmentOriginalName = attachment.name.slice(0, 255);
      attachmentMime = (attachment.type || "application/octet-stream").slice(0, 100);
      attachmentSize = buf.length;
    }

    const details = {
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

    await prisma.$executeRawUnsafe(
      `INSERT INTO hr_candidate_applications
      (first_name, last_name, email, phone, position_id, position_name, notes, status, source, valid_from, valid_to, ip_address, user_agent, details_json, consent_given, consent_date, attachment_path, attachment_original_name, attachment_mime, attachment_size)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      firstName,
      lastName,
      emailValue,
      phoneValue || null,
      positionId,
      positionName,
      notesValue || null,
      sourceValue,
      dateFrom,
      dateTo,
      ip,
      req.headers.get("user-agent") ?? null,
      JSON.stringify(details),
      consentGiven,
      consentDate,
      attachmentPath,
      attachmentOriginalName,
      attachmentMime,
      attachmentSize
    );

    const idRows = (await prisma.$queryRawUnsafe(
      `SELECT id
       FROM hr_candidate_applications
       WHERE email = ? AND first_name = ? AND last_name = ?
       ORDER BY id DESC
       LIMIT 1`,
      emailValue,
      firstName,
      lastName
    )) as { id: number }[];
    const appId = idRows[0]?.id ?? 0;

    if (appId > 0) {
      await logPersonalistikaAudit({
        userId: null,
        action: "create:public_application",
        tableName: "hr_candidate_applications",
        recordId: appId,
        newValues: {
          first_name: firstName,
          last_name: lastName,
          email: emailValue,
          source: sourceValue,
          position_id: positionId,
        },
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") ?? null,
      });

      const adminUserIds = await getUsersWithModuleAdmin("personalistika");
      if (adminUserIds.length > 0) {
        await prisma.notifications.createMany({
          data: adminUserIds.map((userId) => ({
            user_id: userId,
            title: "Nový dotazník uchazeče",
            message: `${lastName} ${firstName} odeslal/a nový dotazník (#${appId}).`,
            type: "personalistika_application",
            link: "/personalistika",
          })),
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Dotazník byl úspěšně odeslán.",
    });
  } catch (error) {
    console.error("Public personalistika POST error:", error);
    return NextResponse.json({ error: "Chyba systému, zkuste to později." }, { status: 500 });
  }
}
