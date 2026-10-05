import { readdirSync, readFileSync } from "fs";
import path from "path";
import nodemailer from "nodemailer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { withTestMailPolicy } from "./mail-transport";

type JsonInfo = { envelope: { to: string[] }; message: string };

async function send(env: Record<string, string>) {
  const transporter = withTestMailPolicy(nodemailer.createTransport({ jsonTransport: true }), env);
  const info = (await transporter.sendMail({
    from: "sysmail@example.com",
    to: "jan.novak@example.com",
    cc: "ucetni@example.com",
    subject: "Byl vám přidělen majetek",
    text: "Dobrý den",
  })) as unknown as JsonInfo;
  return { envelopeTo: info.envelope.to, message: JSON.parse(info.message) as { subject: string } };
}

afterEach(() => vi.restoreAllMocks());

describe("withTestMailPolicy", () => {
  it("na produkci (bez APP_ENV=test a přesměrování) e-mail nemění", async () => {
    const { envelopeTo, message } = await send({});
    expect(envelopeTo).toEqual(["jan.novak@example.com", "ucetni@example.com"]);
    expect(message.subject).toBe("Byl vám přidělen majetek");
  });

  it("s EMAIL_REDIRECT_TO doručí jen na testovací schránku s [TEST]", async () => {
    const { envelopeTo, message } = await send({ APP_ENV: "test", EMAIL_REDIRECT_TO: "test@example.com" });
    expect(envelopeTo).toEqual(["test@example.com"]);
    expect(message.subject).toBe("[TEST] Byl vám přidělen majetek");
  });

  it("na testu bez přesměrování nic neodešle přes SMTP, ale ani nespadne", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const smtp = nodemailer.createTransport({ host: "smtp.invalid", port: 25 });
    const guarded = withTestMailPolicy(smtp, { APP_ENV: "test" });
    expect(guarded).not.toBe(smtp);
    await expect(
      guarded.sendMail({ from: "sysmail@example.com", to: "jan.novak@example.com", subject: "X", text: "Y" })
    ).resolves.toBeDefined();
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe("pojistka je zapojená u všech e-mailů", () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(full);
      return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
    });
  }

  it("každé SMTP spojení v lib/ a app/ jde přes withTestMailPolicy", () => {
    const files = ["lib", "app"].flatMap((d) => sourceFiles(path.join(process.cwd(), d)));
    const unguarded = files
      .filter((f) => !f.endsWith(path.join("lib", "mail-transport.ts")))
      .filter((f) => {
        const source = readFileSync(f, "utf8");
        const all = (source.match(/nodemailer\.createTransport\(/g) ?? []).length;
        const guarded = (source.match(/withTestMailPolicy\(\s*nodemailer\.createTransport\(/g) ?? []).length;
        return all !== guarded;
      });
    expect(unguarded).toEqual([]);
  });
});

describe("withTestMailPolicy — zpevnění", () => {
  it("explicitní envelope na skutečnou adresu se v testu přesměruje", async () => {
    const transporter = withTestMailPolicy(nodemailer.createTransport({ jsonTransport: true }), {
      EMAIL_REDIRECT_TO: "test@example.com",
    });
    const info = (await transporter.sendMail({
      from: "sysmail@example.com",
      to: "jan.novak@example.com",
      envelope: { from: "sysmail@example.com", to: ["real@example.com"] },
      subject: "X",
      text: "Y",
    })) as unknown as JsonInfo;
    expect(info.envelope.to).toEqual(["test@example.com"]);
  });

  it("aktivní přesměrování jednou zaloguje varování", async () => {
    vi.resetModules();
    const fresh = await import("./mail-transport");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    fresh.withTestMailPolicy(nodemailer.createTransport({ jsonTransport: true }), { EMAIL_REDIRECT_TO: "t@example.com" });
    fresh.withTestMailPolicy(nodemailer.createTransport({ jsonTransport: true }), { EMAIL_REDIRECT_TO: "t@example.com" });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
