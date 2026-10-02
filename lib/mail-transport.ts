import nodemailer, { type Transporter } from "nodemailer";
import { applyTestRedirect, testMailMode, type MailPolicyEnv } from "@/lib/email-test-redirect";

/** Varování o aktivním přesměrování jen jednou za běh serveru. */
let redirectWarned = false;

/**
 * Obalí SMTP spojení pojistkou testovacího prostředí (viz `lib/email-test-redirect.ts`).
 * Každé `nodemailer.createTransport(...)` v aplikaci má jít přes tuto funkci.
 */
export function withTestMailPolicy<T extends Transporter>(
  transporter: T,
  env: MailPolicyEnv = { APP_ENV: process.env.APP_ENV, EMAIL_REDIRECT_TO: process.env.EMAIL_REDIRECT_TO }
): T {
  const mode = testMailMode(env);
  if (mode === "off") return transporter;

  if (mode === "block") {
    console.warn("E-mail neodeslán: testovací prostředí (APP_ENV=test) nemá nastavené EMAIL_REDIRECT_TO.");
    // Transport, který zprávu jen sestaví — nic neodešle a volající nespadne.
    return nodemailer.createTransport({ jsonTransport: true }) as unknown as T;
  }

  const redirectTo = String(env.EMAIL_REDIRECT_TO).trim();
  if (!redirectWarned) {
    redirectWarned = true;
    console.warn(`E-maily se přesměrovávají na EMAIL_REDIRECT_TO (${redirectTo}) s předmětem [TEST].`);
  }
  transporter.use("compile", (mail, done) => {
    try {
      applyTestRedirect(mail.data, redirectTo);
      done();
    } catch (e) {
      done(e instanceof Error ? e : new Error(String(e)));
    }
  });
  return transporter;
}
