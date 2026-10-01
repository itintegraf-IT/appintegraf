/**
 * Pojistka testovacího prostředí pro e-maily (čistá logika, bez nodemaileru).
 *
 * - produkce (bez APP_ENV=test a bez EMAIL_REDIRECT_TO): beze změny
 * - EMAIL_REDIRECT_TO nastaveno: vše jde jen na tuto adresu, předmět [TEST]
 * - APP_ENV=test bez EMAIL_REDIRECT_TO: neodejde nic
 */

export type MailPolicyEnv = { APP_ENV?: string; EMAIL_REDIRECT_TO?: string };
export type TestMailMode = "off" | "redirect" | "block";

export function testMailMode(env: MailPolicyEnv): TestMailMode {
  if (env.EMAIL_REDIRECT_TO?.trim()) return "redirect";
  return env.APP_ENV === "test" ? "block" : "off";
}

type MailData = {
  to?: unknown;
  cc?: unknown;
  bcc?: unknown;
  subject?: string;
  text?: unknown;
  html?: unknown;
};

function addresses(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap(addresses);
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (typeof value === "object" && "address" in value) {
    const { name, address } = value as { name?: unknown; address?: unknown };
    return [name ? `${String(name)} <${String(address)}>` : String(address)];
  }
  return [];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Přepíše zprávu (na místě) tak, aby došla jen na `redirectTo`. */
export function applyTestRedirect(data: MailData, redirectTo: string): void {
  const original = [
    ...addresses(data.to),
    ...addresses(data.cc).map((a) => `${a} (kopie)`),
    ...addresses(data.bcc).map((a) => `${a} (skrytá kopie)`),
  ];
  data.to = redirectTo;
  delete data.cc;
  delete data.bcc;

  const subject = data.subject ?? "";
  data.subject = subject.startsWith("[TEST]") ? subject : `[TEST] ${subject}`;

  const note = `[TEST] Původní příjemci: ${original.join(", ") || "—"}`;
  if (typeof data.text === "string") data.text = `${note}\n\n${data.text}`;
  if (typeof data.html === "string") {
    const block = `<p style="padding:8px;border:1px solid #b91c1c;color:#b91c1c;font-family:Arial,sans-serif">${escapeHtml(note)}</p>`;
    const body = /<body[^>]*>/i.exec(data.html);
    data.html = body
      ? data.html.slice(0, body.index + body[0].length) + block + data.html.slice(body.index + body[0].length)
      : block + data.html;
  }
}
