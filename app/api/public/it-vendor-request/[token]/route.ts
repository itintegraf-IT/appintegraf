import { NextRequest, NextResponse } from "next/server";
import { getRequestIp } from "@/lib/auth-audit";
import { rateLimit } from "@/lib/rate-limit";
import {
  findItVendorLinkByRawToken,
  itVendorLinkAccess,
} from "@/lib/it-vendor-request/tokens";
import { serializePublic } from "@/lib/it-vendor-request/serialize";
import {
  isHoneypotTriggered,
  vendorFormSchema,
} from "@/lib/it-vendor-request/validation";
import { saveVendorForm, submitVendorForm } from "@/lib/it-vendor-request/persist";
import {
  ALLOCATION_MODES,
  CONNECTION_TYPES,
  CONTACT_ROLES,
  DHCP_MODES,
  DIRECTIONS,
  DOC_CATALOG,
  ENCRYPTION_OPTIONS,
  INTERFACE_TYPES,
  NETWORK_PLACEMENTS,
  PROTOCOL_CATALOG,
  PROTOCOLS,
  REMOTE_ACCESS_METHODS,
  SECURITY_QUESTIONS,
  SOURCE_TARGET_KINDS,
  VALIDITY_OPTIONS,
  YES_NO,
  YES_NO_PENDING,
} from "@/lib/it-vendor-request/lookups";

type Ctx = { params: Promise<{ token: string }> };

const WINDOW_MS = 10 * 60 * 1000;

function tooMany() {
  return NextResponse.json(
    { error: "Příliš mnoho požadavků, zkuste to za chvíli." },
    { status: 429 }
  );
}

async function resolveLink(token: string) {
  const link = await findItVendorLinkByRawToken(token);
  if (!link) return { error: "Odkaz neexistuje", status: 404 as const, access: "missing" as const };
  const access = itVendorLinkAccess(link);
  if (access === "revoked") {
    return { error: "Odkaz byl zrušen", status: 410 as const, access };
  }
  if (access === "expired") {
    return { error: "Odkaz vypršel", status: 410 as const, access };
  }
  return { link, access: "ok" as const };
}

const lookups = {
  interface_types: INTERFACE_TYPES,
  yes_no: YES_NO,
  yes_no_pending: YES_NO_PENDING,
  allocation_modes: ALLOCATION_MODES,
  protocols: PROTOCOLS,
  directions: DIRECTIONS,
  source_target_kinds: SOURCE_TARGET_KINDS,
  validity_options: VALIDITY_OPTIONS,
  encryption_options: ENCRYPTION_OPTIONS,
  connection_types: CONNECTION_TYPES,
  dhcp_modes: DHCP_MODES,
  remote_access_methods: REMOTE_ACCESS_METHODS,
  network_placements: NETWORK_PLACEMENTS,
  protocol_catalog: PROTOCOL_CATALOG,
  security_questions: SECURITY_QUESTIONS,
  doc_catalog: DOC_CATALOG,
  contact_roles: CONTACT_ROLES,
};

export async function GET(_req: NextRequest, ctx: Ctx) {
  const token = (await ctx.params).token;
  if (!token || token.length < 20) {
    return NextResponse.json({ error: "Neplatný odkaz" }, { status: 400 });
  }

  const resolved = await resolveLink(token);
  if ("error" in resolved && !("link" in resolved)) {
    return NextResponse.json({ error: resolved.error, access: resolved.access }, { status: resolved.status });
  }

  const { link } = resolved as { link: NonNullable<Awaited<ReturnType<typeof findItVendorLinkByRawToken>>> };
  return NextResponse.json({
    item: serializePublic(link.request),
    lookups,
  });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const token = (await ctx.params).token;
  const ip = ((await getRequestIp()) ?? "unknown").slice(0, 64);
  const rl = await rateLimit({ key: `it-vendor-put:${ip}`, max: 40, windowMs: WINDOW_MS });
  if (!rl.allowed) return tooMany();

  const resolved = await resolveLink(token);
  if ("error" in resolved && !("link" in resolved)) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { link } = resolved as { link: NonNullable<Awaited<ReturnType<typeof findItVendorLinkByRawToken>>> };

  if (link.request.status !== "sent") {
    return NextResponse.json(
      { error: "Formulář již nelze upravit (byl odeslán nebo není aktivní)." },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => null);
  if (isHoneypotTriggered(body)) {
    return NextResponse.json({ success: true });
  }

  const parsed = vendorFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Neplatná data", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await saveVendorForm(link.request_id, parsed.data);
    const refreshed = await findItVendorLinkByRawToken(token);
    return NextResponse.json({
      success: true,
      item: refreshed ? serializePublic(refreshed.request) : null,
    });
  } catch (e) {
    console.error("public it-vendor PUT:", e);
    return NextResponse.json({ error: "Chyba při ukládání" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const token = (await ctx.params).token;
  const ip = ((await getRequestIp()) ?? "unknown").slice(0, 64);
  const rl = await rateLimit({ key: `it-vendor-post:${ip}`, max: 10, windowMs: WINDOW_MS });
  if (!rl.allowed) return tooMany();

  const resolved = await resolveLink(token);
  if ("error" in resolved && !("link" in resolved)) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { link } = resolved as { link: NonNullable<Awaited<ReturnType<typeof findItVendorLinkByRawToken>>> };

  if (link.request.status !== "sent") {
    return NextResponse.json(
      { error: "Formulář již byl odeslán nebo není aktivní." },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => null);
  if (isHoneypotTriggered(body)) {
    return NextResponse.json({ success: true, message: "Formulář odeslán." });
  }

  const parsed = vendorFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Neplatná data", details: parsed.error.flatten() }, { status: 400 });
  }

  if (!parsed.data.vendor_signer_name) {
    return NextResponse.json(
      { error: "Před odesláním vyplňte jméno podpisující osoby dodavatele (sekce 4)." },
      { status: 400 }
    );
  }
  if (!parsed.data.vendor_company) {
    return NextResponse.json(
      { error: "Vyplňte název firmy dodavatele." },
      { status: 400 }
    );
  }
  const hasContactEmail =
    Boolean(parsed.data.contact_email) ||
    (parsed.data.contacts ?? []).some((c) => c.email);
  if (!hasContactEmail) {
    return NextResponse.json(
      { error: "Vyplňte alespoň jeden kontakt s e-mailem." },
      { status: 400 }
    );
  }
  const hasDevice = (parsed.data.interfaces ?? []).some(
    (r) => r.device_group || r.interface_type || r.port_count != null || r.note
  );
  const hasIpReq = (parsed.data.ips ?? []).some(
    (r) => r.device_service || r.ip_count != null || r.allocation_mode
  );
  const hasFw = (parsed.data.firewall_rules ?? []).some(
    (r) => r.service_name || r.target_ports || r.purpose
  );
  if (!hasDevice && !hasIpReq && !hasFw) {
    return NextResponse.json(
      {
        error:
          "Vyplňte alespoň jedno zařízení (sekce 2) nebo jedno firewall spojení (sekce 3).",
      },
      { status: 400 }
    );
  }

  try {
    await submitVendorForm(link.request_id, parsed.data);
    return NextResponse.json({
      success: true,
      message: "Formulář byl úspěšně odeslán. Děkujeme.",
    });
  } catch (e) {
    console.error("public it-vendor POST:", e);
    return NextResponse.json({ error: "Chyba při odeslání" }, { status: 500 });
  }
}
