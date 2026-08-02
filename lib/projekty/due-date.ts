import { format } from "date-fns";
import { cs } from "date-fns/locale";

/**
 * Jediný zdroj pravdy pro sémantiku a formát termínů v modulu Projekty.
 * Sjednocuje dřívější tři nezávislé implementace „po termínu"
 * (CardItem, ListCardRow, card-filters) a čtyři formáty data.
 */

export type DueStatus = "overdue" | "today" | "upcoming" | "none";

/** Lokální půlnoc — hranice dne pro veškerou due-date logiku modulu. */
export function startOfLocalDay(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Stav termínu pro vizuální signalizaci (badge). Dokončená karta je vždy
 * "none" — hotové věci nehoří, bez ohledu na termín. Hranice dne přes
 * kalendářní den (startOfLocalDay), ne +24 h — dny s přechodem letního
 * času mají 23/25 hodin.
 */
export function getDueStatus(
  due: Date | string | null | undefined,
  completed: boolean,
): DueStatus {
  if (!due || completed) return "none";
  const d = new Date(due);
  const today = startOfLocalDay();
  const dueDay = startOfLocalDay(d);
  if (dueDay.getTime() < today.getTime()) return "overdue";
  if (dueDay.getTime() === today.getTime()) return "today";
  return "upcoming";
}

const DUE_FORMATS = {
  short: "d. M.",
  withYear: "d. M. yyyy",
  withTime: "d. M. yyyy HH:mm",
} as const;

export type DueFormatVariant = keyof typeof DUE_FORMATS;

export function formatDue(
  date: Date | string,
  variant: DueFormatVariant = "short",
): string {
  return format(new Date(date), DUE_FORMATS[variant], { locale: cs });
}
