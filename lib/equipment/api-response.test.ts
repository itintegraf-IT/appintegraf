import { describe, expect, it } from "vitest";
import { readApiResponse, readPdfResponse } from "./api-response";

/** Odpověď tak, jak ji vidí fetch po přesměrování (Response z konstruktoru má redirected=false a url=""). */
function response(body: string, init: ResponseInit & { redirectedTo?: string; contentType?: string }) {
  const res = new Response(body, {
    status: init.status ?? 200,
    headers: { "content-type": init.contentType ?? "application/json" },
  });
  if (init.redirectedTo) {
    Object.defineProperty(res, "redirected", { value: true });
    Object.defineProperty(res, "url", { value: init.redirectedTo });
  }
  return res;
}

describe("readApiResponse", () => {
  it("přesměrování na přihlášení = vypršelé přihlášení, ne úspěch", async () => {
    const res = response("<!doctype html><title>Přihlášení</title>", {
      contentType: "text/html; charset=utf-8",
      redirectedTo: "http://localhost:3000/login?callbackUrl=%2Fapi%2Fequipment",
    });
    await expect(readApiResponse(res, "Uložení se nezdařilo.")).resolves.toMatchObject({
      ok: false,
      sessionExpired: true,
    });
  });

  it("HTML místo JSON s kódem 200 je přihlašovací stránka", async () => {
    const res = response("<html></html>", { contentType: "text/html" });
    await expect(readApiResponse(res, "x")).resolves.toMatchObject({ ok: false, sessionExpired: true });
  });

  it("401 z API = vypršelé přihlášení", async () => {
    const res = response(JSON.stringify({ error: "Neautorizováno" }), { status: 401 });
    await expect(readApiResponse(res, "x")).resolves.toMatchObject({ ok: false, sessionExpired: true });
  });

  it("chyba API předá českou hlášku serveru i pole, ke kterému patří", async () => {
    const res = response(JSON.stringify({ error: "Inventární číslo 1215 už existuje.", field: "assetTag" }), {
      status: 400,
    });
    await expect(readApiResponse(res, "Uložení se nezdařilo.")).resolves.toEqual({
      ok: false,
      sessionExpired: false,
      error: "Inventární číslo 1215 už existuje.",
      field: "assetTag",
    });
  });

  it("chyba serveru bez JSON dostane obecnou hlášku", async () => {
    const res = response("Internal Server Error", { status: 500, contentType: "text/plain" });
    await expect(readApiResponse(res, "Uložení se nezdařilo.")).resolves.toEqual({
      ok: false,
      sessionExpired: false,
      error: "Uložení se nezdařilo.",
    });
  });

  it("úspěch vrátí data", async () => {
    const res = response(JSON.stringify({ success: true, id: 7 }), { status: 200 });
    await expect(readApiResponse(res, "x")).resolves.toEqual({ ok: true, data: { success: true, id: 7 } });
  });
});

describe("readPdfResponse", () => {
  it("PDF s kódem 200 je úspěch a nese hlavičky", async () => {
    const res = new Response(new Uint8Array([37, 80, 68, 70]), {
      status: 200,
      headers: { "content-type": "application/pdf", "x-labels-ids": "3,1", "x-labels-skipped": "2" },
    });
    const result = await readPdfResponse(res, "Tisk se nepodařil.");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.blob.size).toBe(4);
      expect(result.headers.get("x-labels-ids")).toBe("3,1");
    }
  });

  it("HTML s kódem 200 je přihlašovací stránka, ne PDF", async () => {
    const res = response("<html></html>", { contentType: "text/html" });
    await expect(readPdfResponse(res, "x")).resolves.toMatchObject({ ok: false, sessionExpired: true });
  });

  it("chyba API předá českou hlášku", async () => {
    const res = response(JSON.stringify({ error: "Pozice na archu musí být celé číslo 1–24." }), { status: 400 });
    await expect(readPdfResponse(res, "x")).resolves.toEqual({
      ok: false,
      sessionExpired: false,
      error: "Pozice na archu musí být celé číslo 1–24.",
    });
  });
});
