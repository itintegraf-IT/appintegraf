/**
 * Kam vede odkaz z QR štítku (`/q/<kód>`) — čistá logika bez DB.
 * Položku, kterou uživatel nesmí vidět, neprozradí ani názvem.
 */

import type { ScanResolution } from "@/lib/equipment/scan-code";

export type QrLandingContext = {
  /** Smí číst položku z výsledku (item / ambiguous). */
  canReadItem: boolean;
  /** Smí číst místnosti (přístup k Majetku). */
  canReadRooms: boolean;
  /** Popisky pro volbu u nejednoznačného kódu. */
  itemLabel?: string;
  roomLabel?: string;
};

export type QrLanding =
  | { kind: "redirect"; href: string }
  | { kind: "choose"; item: { href: string; label: string }; room: { href: string; label: string } }
  | { kind: "message"; tone: "info" | "warning"; title: string; text: string };

const NO_ITEM_ACCESS: QrLanding = {
  kind: "message",
  tone: "warning",
  title: "Nemáte oprávnění",
  text: "K této položce nemáte přístup. O oprávnění ke skupině požádejte správce majetku.",
};

const NO_MODULE_ACCESS: QrLanding = {
  kind: "message",
  tone: "warning",
  title: "Nemáte oprávnění",
  text: "K modulu Majetek nemáte přístup. O oprávnění požádejte správce majetku.",
};

export function decideQrLanding(resolution: ScanResolution, ctx: QrLandingContext): QrLanding {
  switch (resolution.type) {
    case "item":
      return ctx.canReadItem ? { kind: "redirect", href: `/equipment/${resolution.itemId}` } : NO_ITEM_ACCESS;
    case "room":
      return ctx.canReadRooms ? { kind: "redirect", href: `/equipment/rooms/${resolution.roomId}` } : NO_MODULE_ACCESS;
    case "ambiguous": {
      const itemHref = `/equipment/${resolution.itemId}`;
      const roomHref = `/equipment/rooms/${resolution.roomId}`;
      if (ctx.canReadItem && ctx.canReadRooms) {
        return {
          kind: "choose",
          item: { href: itemHref, label: ctx.itemLabel ?? "Položka" },
          room: { href: roomHref, label: ctx.roomLabel ?? "Místnost" },
        };
      }
      if (ctx.canReadRooms) return { kind: "redirect", href: roomHref };
      if (ctx.canReadItem) return { kind: "redirect", href: itemHref };
      return NO_MODULE_ACCESS;
    }
    case "qr_pool":
      return {
        kind: "message",
        tone: "info",
        title: "Štítek zatím není přiřazen",
        text: "Tento kód ještě nepatří žádné položce v evidenci.",
      };
    case "wrong_kind":
    case "not_found":
      return {
        kind: "message",
        tone: "warning",
        title: "Kód nebyl nalezen",
        text: "Štítek nepatří žádné položce ani místnosti v evidenci. Zkontrolujte, že je ze správné aplikace.",
      };
  }
}
