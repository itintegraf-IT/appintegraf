export const RECURRENCE_OPTIONS = [
  { value: "none", label: "Neopakovat" },
  { value: "daily", label: "Každý den" },
  { value: "weekly", label: "Každý týden" },
  { value: "monthly", label: "Každý měsíc" },
] as const;

/** Minuty před začátkem; prázdné = žádná připomínka. */
export const REMINDER_MINUTE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Žádná" },
  { value: "15", label: "15 minut před" },
  { value: "30", label: "30 minut před" },
  { value: "60", label: "1 hodina před" },
  { value: "120", label: "2 hodiny před" },
  { value: "1440", label: "1 den před" },
];
