import { beforeEach, describe, expect, it, vi } from "vitest";

const { sent } = vi.hoisted(() => ({ sent: [] as Array<{ html?: string; subject?: string }> }));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({
      use: () => undefined,
      sendMail: async (opts: { html?: string; subject?: string }) => {
        sent.push(opts);
        return {};
      },
    }),
  },
}));
vi.mock("@/lib/email-settings", () => ({
  getEmailSettings: async () => ({
    enabled: true,
    host: "smtp.test.invalid",
    port: 25,
    secure: false,
    user: "u",
    password: "p",
    from: "sysmail@test.invalid",
    fromName: "",
  }),
  formatSmtpFrom: () => "sysmail@test.invalid",
}));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/makety-softproof-templates-db", () => ({ loadSoftproofTemplates: async () => [] }));

import { sendEquipmentMovementEmail, sendEquipmentRequestResultEmail } from "./email";

beforeEach(() => {
  sent.length = 0;
});

describe("e-maily Majetku escapují vstupy", () => {
  it("e-mail o pohybu majetku nevloží HTML ze jména, textu ani popisku", async () => {
    await sendEquipmentMovementEmail({
      toEmail: "jan@integraf.cz",
      toName: "<img src=x onerror=alert(1)>",
      subject: "Pohyb majetku",
      intro: 'Položka <b>"Notebook"</b> & spol.',
      protocolPath: "/equipment/protokol/predani?assignmentId=1",
      protocolLabel: "<i>Otevřít</i>",
    });
    const html = sent[0]?.html ?? "";
    expect(html).not.toMatch(/<img|<b>|<i>/);
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("&lt;b&gt;&quot;Notebook&quot;&lt;/b&gt; &amp; spol.");
  });

  it("e-mail o výsledku požadavku escapuje jméno, typ i stanoviska a zachová řádky", async () => {
    await sendEquipmentRequestResultEmail({
      toEmail: "zadatel@example.com",
      toName: "<script>alert(1)</script>",
      requestId: 7,
      equipmentType: "<svg onload=alert(1)>",
      result: "approved",
      itResponse: "Řádek 1\n<b>Řádek 2</b>",
      adminResponse: "Schváleno & objednáno",
    });
    const html = sent[0]?.html ?? "";
    expect(html).not.toMatch(/<script|<svg|<b>Řádek/);
    expect(html).toContain("Řádek 1<br>&lt;b&gt;Řádek 2&lt;/b&gt;");
    expect(html).toContain("Schváleno &amp; objednáno");
  });
});
