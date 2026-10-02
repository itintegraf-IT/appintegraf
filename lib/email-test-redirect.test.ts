import { describe, expect, it } from "vitest";
import { applyTestRedirect, testMailMode } from "./email-test-redirect";

describe("testMailMode", () => {
  it.each([
    [{}, "off"],
    [{ APP_ENV: "production" }, "off"],
    [{ APP_ENV: "test" }, "block"],
    [{ APP_ENV: "test", EMAIL_REDIRECT_TO: "   " }, "block"],
    [{ APP_ENV: "test", EMAIL_REDIRECT_TO: "test@example.com" }, "redirect"],
    [{ EMAIL_REDIRECT_TO: "vyvoj@example.com" }, "redirect"],
    [{ APP_ENV: " Test " }, "block"],
    [{ APP_ENV: "TEST", EMAIL_REDIRECT_TO: "test@example.com" }, "redirect"],
  ] as const)("%j → %s", (env, mode) => {
    expect(testMailMode(env)).toBe(mode);
  });
});

describe("applyTestRedirect", () => {
  it("pošle e-mail jen na testovací schránku a odstraní kopie", () => {
    const data: Record<string, unknown> = {
      to: "jan.novak@example.com",
      cc: ["ucetni@example.com"],
      bcc: { name: "Archiv", address: "archiv@example.com" },
      subject: "Byl vám přidělen majetek",
      text: "Dobrý den",
    };
    applyTestRedirect(data, "test@example.com");
    expect(data.to).toBe("test@example.com");
    expect(data.cc).toBeUndefined();
    expect(data.bcc).toBeUndefined();
    expect(data.subject).toBe("[TEST] Byl vám přidělen majetek");
  });

  it("do textu zapíše původní příjemce včetně kopií", () => {
    const data: Record<string, unknown> = {
      to: ["a@example.com", { name: "Bára", address: "b@example.com" }],
      cc: "c@example.com",
      subject: "X",
      text: "Obsah",
    };
    applyTestRedirect(data, "test@example.com");
    const text = String(data.text);
    expect(text).toContain("a@example.com");
    expect(text).toContain("b@example.com");
    expect(text).toContain("c@example.com");
    expect(text.endsWith("Obsah")).toBe(true);
  });

  it("předmět neoznačí [TEST] dvakrát", () => {
    const data: Record<string, unknown> = { to: "a@example.com", subject: "[TEST] Už označeno" };
    applyTestRedirect(data, "test@example.com");
    expect(data.subject).toBe("[TEST] Už označeno");
  });

  it("v HTML vloží upozornění hned za <body> a adresy escapuje", () => {
    const data: Record<string, unknown> = {
      to: '"Jan <script>" <jan@example.com>',
      subject: "X",
      html: '<html><body style="x"><p>Obsah</p></body></html>',
    };
    applyTestRedirect(data, "test@example.com");
    const html = String(data.html);
    expect(html.indexOf("[TEST]")).toBeGreaterThan(html.indexOf("<body"));
    expect(html.indexOf("[TEST]")).toBeLessThan(html.indexOf("<p>Obsah</p>"));
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("HTML bez <body> dostane upozornění na začátek", () => {
    const data: Record<string, unknown> = { to: "a@example.com", subject: "X", html: "<p>Obsah</p>" };
    applyTestRedirect(data, "test@example.com");
    expect(String(data.html).startsWith("<p")).toBe(true);
    expect(String(data.html).indexOf("[TEST]")).toBeLessThan(String(data.html).indexOf("Obsah"));
  });
});

describe("applyTestRedirect — žádná cesta ke skutečným příjemcům", () => {
  it("odstraní explicitní envelope a hlavičky To/Cc/Bcc (v libovolné velikosti písmen)", () => {
    const data: Record<string, unknown> = {
      to: "a@example.com",
      envelope: { from: "s@example.com", to: ["real@example.com"] },
      headers: { Cc: "real2@example.com", BCC: "real3@example.com", to: "real4@example.com", "X-Priority": "1" },
      subject: "S",
    };
    applyTestRedirect(data, "test@example.com");
    expect(data.envelope).toBeUndefined();
    expect(data.headers).toEqual({ "X-Priority": "1" });
  });

  it("hlavičky zadané jako pole vyčistí stejně", () => {
    const data: Record<string, unknown> = {
      to: "a@example.com",
      headers: [{ key: "cc", value: "real@example.com" }, { key: "X-A", value: "1" }],
    };
    applyTestRedirect(data, "test@example.com");
    expect(data.headers).toEqual([{ key: "X-A", value: "1" }]);
  });

  it("hotovou (raw) zprávu odmítne — nejde bezpečně přesměrovat", () => {
    expect(() => applyTestRedirect({ raw: "To: real@example.com\r\n\r\nAhoj" } as never, "test@example.com")).toThrow();
  });
});
