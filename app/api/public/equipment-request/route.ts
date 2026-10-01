import { NextRequest, NextResponse } from "next/server";
import { getRequestIp } from "@/lib/auth-audit";
import { createEquipmentRequest } from "@/lib/equipment-request-create";
import {
  PUBLIC_REQUEST_HONEYPOT_FIELD,
  validatePublicEquipmentRequest,
} from "@/lib/equipment/public-request-validation";
import { rateLimit } from "@/lib/rate-limit";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_IP = 5;
const MAX_TOTAL = 30;

export async function POST(req: NextRequest) {
  try {
    // Klíč limitu oříznutý na délku sloupce (rate_limit_hits.key má 128 znaků).
    const ip = ((await getRequestIp()) ?? "unknown").slice(0, 64);
    const perIp = await rateLimit({ key: `public-eq-request:ip:${ip}`, max: MAX_PER_IP, windowMs: WINDOW_MS });
    const total = await rateLimit({ key: "public-eq-request:all", max: MAX_TOTAL, windowMs: WINDOW_MS });
    if (!perIp.allowed || !total.allowed) {
      const retryAfter = Math.max(perIp.retryAfterSeconds, total.retryAfterSeconds, 60);
      return NextResponse.json(
        { error: "Příliš mnoho požadavků, zkuste to prosím za chvíli." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const body: unknown = await req.json().catch(() => null);
    if (body && typeof body === "object") {
      const trap = (body as Record<string, unknown>)[PUBLIC_REQUEST_HONEYPOT_FIELD];
      if (typeof trap === "string" && trap.trim()) {
        console.warn("public equipment request: vyplněné skryté pole, požadavek zahozen");
        return NextResponse.json({ success: true, message: "Požadavek odeslán." });
      }
    }

    const validated = validatePublicEquipmentRequest(body);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const request = await createEquipmentRequest(validated.data);

    return NextResponse.json({
      success: true,
      id: request.id,
      message: `Požadavek úspěšně odeslán! Číslo požadavku: #${request.id}`,
    });
  } catch (e) {
    console.error("Equipment request POST error:", e);
    return NextResponse.json(
      { error: "Chyba systému, zkuste to později" },
      { status: 500 }
    );
  }
}
