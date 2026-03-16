/**
 * Pomocné funkce pro měsíční zobrazení kalendáře.
 * Měsíc = od pondělí prvního týdne do neděle posledního týdne (pro zobrazení mřížky).
 */

import { getWeekStart } from "./week-utils";

export function getMonthStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getMonthEnd(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** První den zobrazené mřížky (pondělí před nebo na 1.) */
export function getMonthGridStart(date: Date): Date {
  const first = getMonthStart(date);
  return getWeekStart(first);
}

/** Poslední den zobrazené mřížky (neděle po konci měsíce) */
export function getMonthGridEnd(date: Date): Date {
  const last = getMonthEnd(date);
  const gridStart = getMonthGridStart(date);
  const days = 6 * 7;
  const end = new Date(gridStart);
  end.setDate(end.getDate() + days);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function getPrevMonth(date: Date): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() - 1);
  return d;
}

export function getNextMonth(date: Date): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  return d;
}

export function getCurrentMonth(): Date {
  return new Date();
}

export function formatMonth(date: Date): string {
  return date.toLocaleDateString("cs-CZ", { month: "long", year: "numeric" });
}
