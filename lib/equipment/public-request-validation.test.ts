import { describe, expect, it } from "vitest";
import {
  isHoneypotTriggered,
  PUBLIC_REQUEST_HONEYPOT_FIELD,
  validatePublicEquipmentRequest,
} from "./public-request-validation";

const valid = {
  requester_name: "  Jan Novák ",
  requester_email: "jan.novak@example.com",
  equipment_type: "Notebook",
  description: "Potřebuji notebook pro nového kolegu.",
};

describe("validatePublicEquipmentRequest", () => {
  it("platný požadavek ořízne mezery a nepovinná pole nastaví na null", () => {
    expect(validatePublicEquipmentRequest(valid)).toEqual({
      ok: true,
      data: {
        requester_name: "Jan Novák",
        requester_email: "jan.novak@example.com",
        requester_phone: null,
        department: null,
        position: null,
        equipment_type: "Notebook",
        description: "Potřebuji notebook pro nového kolegu.",
        priority: "st_edn_",
      },
    });
  });

  it("e-mail, který není text, odmítne (dřív končil chybou 500)", () => {
    expect(validatePublicEquipmentRequest({ ...valid, requester_email: 42 }).ok).toBe(false);
    expect(validatePublicEquipmentRequest({ ...valid, requester_email: ["a@b.cz"] }).ok).toBe(false);
  });

  it.each([
    ["chybí popis", { ...valid, description: "  " }],
    ["chybí jméno", { ...valid, requester_name: undefined }],
    ["neplatný e-mail", { ...valid, requester_email: "jan.novak" }],
    ["jméno přes 100 znaků", { ...valid, requester_name: "x".repeat(101) }],
    ["telefon přes 20 znaků", { ...valid, requester_phone: "1".repeat(21) }],
    ["popis přes 5 000 znaků", { ...valid, description: "x".repeat(5001) }],
    ["tělo není objekt", null],
    ["tělo je pole", [valid]],
  ])("%s → odmítne", (_label, body) => {
    expect(validatePublicEquipmentRequest(body).ok).toBe(false);
  });

  it("hraniční délky ještě projdou", () => {
    const res = validatePublicEquipmentRequest({
      ...valid,
      requester_name: "x".repeat(100),
      requester_phone: "1".repeat(20),
      description: "x".repeat(5000),
    });
    expect(res.ok).toBe(true);
  });

  it("prioritu předá dál (whitelist hlídá createEquipmentRequest)", () => {
    const res = validatePublicEquipmentRequest({ ...valid, priority: "vysok_" });
    expect(res.ok && res.data.priority).toBe("vysok_");
  });
});

describe("řídicí znaky", () => {
  it.each([
    ["zalomení řádku ve jménu", { ...valid, requester_name: "Jan\nBcc: x@y.cz" }],
    ["obrácení směru textu v typu", { ...valid, equipment_type: "Notebook\u202Eexe.fdp" }],
    ["tabulátor v e-mailu", { ...valid, requester_email: "jan\t@example.com" }],
  ])("%s → odmítne", (_label, body) => {
    expect(validatePublicEquipmentRequest(body).ok).toBe(false);
  });

  it("v popisu jsou řádky povolené", () => {
    expect(validatePublicEquipmentRequest({ ...valid, description: "Řádek 1\nŘádek 2" }).ok).toBe(true);
  });
});

describe("past na roboty", () => {
  it("má neutrální název, který prohlížeč nevyplní jako firmu ani web", () => {
    expect(PUBLIC_REQUEST_HONEYPOT_FIELD).not.toMatch(/firma|company|web|url|name|mail/i);
  });

  it.each([
    [{ [PUBLIC_REQUEST_HONEYPOT_FIELD]: "http://spam.example" }, true],
    [{ [PUBLIC_REQUEST_HONEYPOT_FIELD]: 1 }, true],
    [{ [PUBLIC_REQUEST_HONEYPOT_FIELD]: true }, true],
    [{ [PUBLIC_REQUEST_HONEYPOT_FIELD]: "" }, false],
    [{ [PUBLIC_REQUEST_HONEYPOT_FIELD]: "   " }, false],
    [{}, false],
    [null, false],
  ])("%j → %s", (body, expected) => {
    expect(isHoneypotTriggered(body)).toBe(expected);
  });
});
