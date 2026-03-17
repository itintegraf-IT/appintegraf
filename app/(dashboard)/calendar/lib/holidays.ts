/**
 * České státní svátky a dny pracovního klidu.
 * Zákon č. 245/2000 Sb., zákon č. 245/2000 Sb. o státních svátcích.
 */

export type Holiday = { date: string; name: string };

/** Pevné svátky: [měsíc 1–12, den] */
const FIXED_HOLIDAYS: [number, number, string][] = [
  [1, 1, "Nový rok / Den obnovy samostatného českého státu"],
  [5, 1, "Svátek práce"],
  [5, 8, "Den vítězství"],
  [7, 5, "Den slovanských věrozvěstů Cyrila a Metoděje"],
  [7, 6, "Den upálení mistra Jana Husa"],
  [9, 28, "Den české státnosti"],
  [10, 28, "Den vzniku samostatného československého státu"],
  [11, 17, "Den boje za svobodu a demokracii"],
  [12, 24, "Štědrý den"],
  [12, 25, "1. svátek vánoční"],
  [12, 26, "2. svátek vánoční"],
];

/** Vypočítá datum Velikonoc (neděle) pro daný rok – Anonymous Gregorian algorithm */
function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

/** Vrátí pohyblivé svátky (Velký pátek, Velikonoční pondělí) pro daný rok */
function getEasterHolidays(year: number): Holiday[] {
  const easter = getEasterSunday(year);
  const goodFriday = new Date(easter);
  goodFriday.setDate(goodFriday.getDate() - 2);
  const easterMonday = new Date(easter);
  easterMonday.setDate(easterMonday.getDate() + 1);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return [
    { date: fmt(goodFriday), name: "Velký pátek" },
    { date: fmt(easterMonday), name: "Velikonoční pondělí" },
  ];
}

/** Vrátí všechny svátky v daném rozsahu datumů (from, to včetně). */
export function getHolidaysForRange(from: string, to: string): Holiday[] {
  const [fromY, fromM, fromD] = from.split("-").map(Number);
  const [toY, toM, toD] = to.split("-").map(Number);
  const fromDate = new Date(fromY, fromM - 1, fromD);
  const toDate = new Date(toY, toM - 1, toD);

  const result: Holiday[] = [];

  for (let year = fromDate.getFullYear(); year <= toDate.getFullYear(); year++) {
    for (const [month, day, name] of FIXED_HOLIDAYS) {
      const d = new Date(year, month - 1, day);
      if (d >= fromDate && d <= toDate) {
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        result.push({ date: dateStr, name });
      }
    }
    for (const h of getEasterHolidays(year)) {
      const d = new Date(h.date);
      if (d >= fromDate && d <= toDate) {
        result.push(h);
      }
    }
  }

  return result.sort((a, b) => a.date.localeCompare(b.date));
}
