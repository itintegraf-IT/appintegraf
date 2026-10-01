import { NextRequest, NextResponse } from "next/server";
import { getRequestIp } from "@/lib/auth-audit";
import { createEquipmentRequest } from "@/lib/equipment-request-create";
import {
  isHoneypotTriggered,
  validatePublicEquipmentRequest,
} from "@/lib/equipment/public-request-validation";
import { rateLimit } from "@/lib/rate-limit";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_IP = 5;
const MAX_TOTAL = 30;

function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Příliš mnoho požadavků, zkuste to prosím za chvíli." },
    { status: 429, headers: { "Retry-After": String(Math.max(retryAfterSeconds, 60)) } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => null);

    // 1) Past na roboty: tichý „úspěch“ bez zápisu a bez čerpání limitů ostatních.
    if (isHoneypotTriggered(body)) {
      console.warn("public equipment request: vyplněné skryté pole, požadavek zahozen");
      return NextResponse.json({ success: true, message: "Požadavek odeslán." });
    }

    // 2) Limit na odesílatele; odmítnutý požadavek už dál nic nečerpá.
    const ip = ((await getRequestIp()) ?? "unknown").slice(0, 64);
    const perIp = await rateLimit({ key: `public-eq-request:ip:${ip}`, max: MAX_PER_IP, windowMs: WINDOW_MS });
    if (!perIp.allowed) return tooManyRequests(perIp.retryAfterSeconds);

    const validated = validatePublicEquipmentRequest(body);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    // 3) Celkový strop počítá jen platné požadavky, které se opravdu uloží.
    const total = await rateLimit({ key: "public-eq-request:all", max: MAX_TOTAL, windowMs: WINDOW_MS });
    if (!total.allowed) return tooManyRequests(total.retryAfterSeconds);

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
