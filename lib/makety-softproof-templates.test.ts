import { describe, expect, it } from "vitest";
import {
  applySoftproofPlaceholders,
  buildSoftproofEmailHtml,
  DEFAULT_SOFTPROOF_TEMPLATES,
  getSoftproofPublicChrome,
  getSoftproofTemplate,
  parseSoftproofTemplatesJson,
  sanitizeSoftproofTemplate,
} from "./makety-softproof-templates";
import {
  hashSoftproofToken,
  softproofLinkAccess,
  validateSoftproofDecision,
} from "./makety-softproof-links";

describe("softproof templates", () => {
  it("nahrazuje placeholdery včetně fallbacku čísla grafiky", () => {
    const out = applySoftproofPlaceholders("Softproof – {{orderNumber}} / {{toName}}", {
      toName: "MART-PLASTIC",
      maketaId: 48,
    });
    expect(out).toBe("Softproof – grafika #48 / MART-PLASTIC");
  });

  it("padá na cs když locale chybí", () => {
    const t = getSoftproofTemplate(DEFAULT_SOFTPROOF_TEMPLATES, "xx");
    expect(t.locale).toBe("cs");
  });

  it("parsuje uložené JSON a ignoruje neplatné položky", () => {
    const parsed = parseSoftproofTemplatesJson(
      JSON.stringify([{ locale: "en", label: "English", subject: "Hello {{toName}}" }, { locale: "" }])
    );
    expect(parsed.some((t) => t.locale === "en")).toBe(true);
    expect(parsed.every((t) => t.locale)).toBe(true);
  });

  it("sanitize doplní chybějící pole z defaultu", () => {
    const t = sanitizeSoftproofTemplate({ locale: "cs", subject: "X" });
    expect(t?.ctaLabel).toBeTruthy();
    expect(t?.subject).toBe("X");
  });

  it("sestaví HTML e-mail s CTA na stránku náhledu", () => {
    const cs = DEFAULT_SOFTPROOF_TEMPLATES.find((t) => t.locale === "cs")!;
    const built = buildSoftproofEmailHtml({
      template: cs,
      vars: {
        toName: "Klient",
        maketaId: 48,
        orderNumber: "Z-1",
        labelCode: "03-03-541",
        fileName: "soft.pdf",
        pageUrl: "https://app.example/public/softproof/abc",
      },
    });
    expect(built.subject).toContain("Z-1");
    expect(built.html).toContain("https://app.example/public/softproof/abc");
    expect(built.html).toContain("Otevřít náhled");
    expect(built.html).not.toContain("/api/makety/softproof/");
  });
});

describe("softproof public chrome", () => {
  it("vrátí anglické nápisy pro en", () => {
    expect(getSoftproofPublicChrome("en").cancelLabel).toBe("Cancel");
    expect(getSoftproofPublicChrome("en").approvedThanks).toMatch(/Thank you/i);
  });

  it("vrátí německé nápisy pro de", () => {
    expect(getSoftproofPublicChrome("de").cancelLabel).toBe("Abbrechen");
  });

  it("neznámý locale padá na cs", () => {
    expect(getSoftproofPublicChrome("xx").cancelLabel).toBe("Zrušit");
    expect(getSoftproofPublicChrome(null).loading).toMatch(/Načítám/);
  });
});

describe("softproof link access", () => {
  const future = new Date(Date.now() + 60_000);
  const past = new Date(Date.now() - 60_000);

  it("ok pro nepoužitý platný odkaz", () => {
    expect(softproofLinkAccess({ used_at: null, used_action: null, expires_at: future })).toBe("ok");
  });

  it("used po schválení", () => {
    expect(
      softproofLinkAccess({
        used_at: new Date(),
        used_action: "approved",
        expires_at: future,
      })
    ).toBe("used");
  });

  it("expired po vypršení", () => {
    expect(softproofLinkAccess({ used_at: null, used_action: null, expires_at: past })).toBe("expired");
  });

  it("revoked při novém odeslání", () => {
    expect(
      softproofLinkAccess({
        used_at: new Date(),
        used_action: "revoked",
        expires_at: future,
      })
    ).toBe("revoked");
  });

  it("hash je stabilní", () => {
    expect(hashSoftproofToken("abc")).toBe(hashSoftproofToken("abc"));
    expect(hashSoftproofToken("abc")).not.toBe(hashSoftproofToken("abd"));
  });
});

describe("validateSoftproofDecision", () => {
  it("reject bez důvodu je 400", () => {
    const r = validateSoftproofDecision("rejected", "   ");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/důvod/i);
  });

  it("approve bez důvodu je ok", () => {
    const r = validateSoftproofDecision("approved", "");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.reason).toBeNull();
  });

  it("approve ignoruje zaslanou poznámku", () => {
    const r = validateSoftproofDecision("approved", "neměla by se uložit");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.reason).toBeNull();
  });

  it("reject s důvodem je ok", () => {
    const r = validateSoftproofDecision("rejected", "špatné barvy");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.action).toBe("rejected");
      expect(r.reason).toBe("špatné barvy");
    }
  });
});
