import { NextRequest, NextResponse } from "next/server";
import { getUsersWithModuleAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import {
  insertCandidateApplication,
  parseApplicationFormData,
} from "@/lib/personalistika-application";
import { ensurePersonalistikaTables } from "@/lib/personalistika-db";
import { logPersonalistikaAudit } from "@/lib/personalistika-audit";

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

    const parsed = await parseApplicationFormData(formData);
    if (!parsed.data) {
      return NextResponse.json({ error: parsed.error ?? "Neplatná data." }, { status: 400 });
    }

    const appId = await insertCandidateApplication(parsed.data, {
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") ?? null,
    });

    if (appId > 0) {
      await logPersonalistikaAudit({
        userId: null,
        action: "create:public_application",
        tableName: "hr_candidate_applications",
        recordId: appId,
        newValues: {
          first_name: parsed.data.firstName,
          last_name: parsed.data.lastName,
          email: parsed.data.email,
          source: parsed.data.source,
          position_id: parsed.data.positionId,
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
            message: `${parsed.data!.lastName} ${parsed.data!.firstName} odeslal/a nový dotazník (#${appId}).`,
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
