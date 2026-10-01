import { describe, expect, it } from "vitest";
import { applyTestRedirect, testMailMode } from "./email-test-redirect";

describe("testMailMode", () => {
  it.each([
    [{}, "off"],
    [{ APP_ENV: "production" }, "off"],
    [{ APP_ENV: "test" }, "block"],
    [{ APP_ENV: "test", EMAIL_REDIRECT_TO: "   " }, "block"],
    [{ APP_ENV: "test", EMAIL_REDIRECT_TO: "test@integraf.cz" }, "redirect"],
    [{ EMAIL_REDIRECT_TO: "vyvoj@integraf.cz" }, "redirect"],
  ] as const)("%j → %s", (env, mode) => {
    expect(testMailMode(env)).toBe(mode);
  });
});

describe("applyTestRedirect", () => {
  it("pošle e-mail jen na testovací schránku a odstraní kopie", () => {
    const data: Record<string, unknown> = {
      to: "jan.novak@integraf.cz",
      cc: ["ucetni@integraf.cz"],
      bcc: { name: "Archiv", address: "archiv@integraf.cz" },
      subject: "Byl vám přidělen majetek",
      text: "Dobrý den",
    };
    applyTestRedirect(data, "test@integraf.cz");
    expect(data.to).toBe("test@integraf.cz");
    expect(data.cc).toBeUndefined();
    expect(data.bcc).toBeUndefined();
    expect(data.subject).toBe("[TEST] Byl vám přidělen majetek");
  });

  it("do textu zapíše původní příjemce včetně kopií", () => {
    const data: Record<string, unknown> = {
      to: ["a@integraf.cz", { name: "Bára", address: "b@integraf.cz" }],
      cc: "c@integraf.cz",
      subject: "X",
      text: "Obsah",
    };
    applyTestRedirect(data, "test@integraf.cz");
    const text = String(data.text);
    expect(text).toContain("a@integraf.cz");
    expect(text).toContain("b@integraf.cz");
    expect(text).toContain("c@integraf.cz");
    expect(text.endsWith("Obsah")).toBe(true);
  });

  it("předmět neoznačí [TEST] dvakrát", () => {
    const data: Record<string, unknown> = { to: "a@integraf.cz", subject: "[TEST] Už označeno" };
    applyTestRedirect(data, "test@integraf.cz");
    expect(data.subject).toBe("[TEST] Už označeno");
  });

  it("v HTML vloží upozornění hned za <body> a adresy escapuje", () => {
    const data: Record<string, unknown> = {
      to: '"Jan <script>" <jan@integraf.cz>',
      subject: "X",
      html: '<html><body style="x"><p>Obsah</p></body></html>',
    };
    applyTestRedirect(data, "test@integraf.cz");
    const html = String(data.html);
    expect(html.indexOf("[TEST]")).toBeGreaterThan(html.indexOf("<body"));
    expect(html.indexOf("[TEST]")).toBeLessThan(html.indexOf("<p>Obsah</p>"));
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("HTML bez <body> dostane upozornění na začátek", () => {
    const data: Record<string, unknown> = { to: "a@integraf.cz", subject: "X", html: "<p>Obsah</p>" };
    applyTestRedirect(data, "test@integraf.cz");
    expect(String(data.html).startsWith("<p")).toBe(true);
    expect(String(data.html).indexOf("[TEST]")).toBeLessThan(String(data.html).indexOf("Obsah"));
  });
});
