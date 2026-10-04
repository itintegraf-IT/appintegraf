import { describe, expect, it } from "vitest";
import { decideQrLanding } from "./qr-landing";

const full = { canReadItem: true, canReadRooms: true, itemLabel: "100123 — Monitor", roomLabel: "1012 — Kancelář" };

describe("decideQrLanding", () => {
  it("položka s oprávněním → detail položky", () => {
    expect(decideQrLanding({ type: "item", itemId: 501 }, full)).toEqual({ kind: "redirect", href: "/equipment/501" });
  });

  it("položka bez oprávnění → hláška bez názvu položky", () => {
    const landing = decideQrLanding({ type: "item", itemId: 501 }, { ...full, canReadItem: false });
    expect(landing.kind).toBe("message");
    expect(JSON.stringify(landing)).not.toContain("Monitor");
    expect(JSON.stringify(landing)).not.toContain("100123");
  });

  it("místnost → detail místnosti", () => {
    expect(decideQrLanding({ type: "room", roomId: 77 }, full)).toEqual({ kind: "redirect", href: "/equipment/rooms/77" });
  });

  it("místnost bez přístupu k Majetku → hláška", () => {
    expect(decideQrLanding({ type: "room", roomId: 77 }, { ...full, canReadRooms: false }).kind).toBe("message");
  });

  it("nejednoznačný kód s oběma oprávněními → volba položka / místnost", () => {
    expect(decideQrLanding({ type: "ambiguous", itemId: 501, roomId: 77 }, full)).toEqual({
      kind: "choose",
      item: { href: "/equipment/501", label: "100123 — Monitor" },
      room: { href: "/equipment/rooms/77", label: "1012 — Kancelář" },
    });
  });

  it("nejednoznačný kód bez práva k položce → rovnou místnost, položka se neprozradí", () => {
    const landing = decideQrLanding({ type: "ambiguous", itemId: 501, roomId: 77 }, { ...full, canReadItem: false });
    expect(landing).toEqual({ kind: "redirect", href: "/equipment/rooms/77" });
  });

  it("nejednoznačný kód bez přístupu k místnostem → položka", () => {
    const landing = decideQrLanding({ type: "ambiguous", itemId: 501, roomId: 77 }, { ...full, canReadRooms: false });
    expect(landing).toEqual({ kind: "redirect", href: "/equipment/501" });
  });

  it("volný kód z fondu → štítek zatím není přiřazen", () => {
    const landing = decideQrLanding({ type: "qr_pool", poolId: 3 }, full);
    expect(landing).toMatchObject({ kind: "message", tone: "info", title: "Štítek zatím není přiřazen" });
  });

  it("nenalezeno → hláška", () => {
    expect(decideQrLanding({ type: "not_found" }, full)).toMatchObject({ kind: "message", title: "Kód nebyl nalezen" });
  });
});
