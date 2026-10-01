import { readFileSync } from "fs";
import path from "path";
import nodemailer from "nodemailer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { withTestMailPolicy } from "./mail-transport";

type JsonInfo = { envelope: { to: string[] }; message: string };

async function send(env: Record<string, string>) {
  const transporter = withTestMailPolicy(nodemailer.createTransport({ jsonTransport: true }), env);
  const info = (await transporter.sendMail({
    from: "sysmail@integraf.cz",
    to: "jan.novak@integraf.cz",
    cc: "ucetni@integraf.cz",
    subject: "Byl vám přidělen majetek",
    text: "Dobrý den",
  })) as unknown as JsonInfo;
  return { envelopeTo: info.envelope.to, message: JSON.parse(info.message) as { subject: string } };
}

afterEach(() => vi.restoreAllMocks());

describe("withTestMailPolicy", () => {
  it("na produkci (bez APP_ENV=test a přesměrování) e-mail nemění", async () => {
    const { envelopeTo, message } = await send({});
    expect(envelopeTo).toEqual(["jan.novak@integraf.cz", "ucetni@integraf.cz"]);
    expect(message.subject).toBe("Byl vám přidělen majetek");
  });

  it("s EMAIL_REDIRECT_TO doručí jen na testovací schránku s [TEST]", async () => {
    const { envelopeTo, message } = await send({ APP_ENV: "test", EMAIL_REDIRECT_TO: "test@integraf.cz" });
    expect(envelopeTo).toEqual(["test@integraf.cz"]);
    expect(message.subject).toBe("[TEST] Byl vám přidělen majetek");
  });

  it("na testu bez přesměrování nic neodešle přes SMTP, ale ani nespadne", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const smtp = nodemailer.createTransport({ host: "smtp.invalid", port: 25 });
    const guarded = withTestMailPolicy(smtp, { APP_ENV: "test" });
    expect(guarded).not.toBe(smtp);
    await expect(
      guarded.sendMail({ from: "sysmail@integraf.cz", to: "jan.novak@integraf.cz", subject: "X", text: "Y" })
    ).resolves.toBeDefined();
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe("pojistka je zapojená u všech e-mailů", () => {
  it.each(["lib/email.ts", "lib/stitky/notify.ts"])("%s vytváří SMTP spojení jen přes withTestMailPolicy", (file) => {
    const source = readFileSync(path.join(process.cwd(), file), "utf8");
    const all = source.match(/nodemailer\.createTransport\(/g) ?? [];
    const guarded = source.match(/withTestMailPolicy\(\s*nodemailer\.createTransport\(/g) ?? [];
    expect(all.length).toBeGreaterThan(0);
    expect(guarded.length).toBe(all.length);
  });
});
