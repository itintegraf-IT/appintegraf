export const HELPDESK_CATEGORY_LABELS: Record<string, string> = {
  hardware: "Hardware",
  software: "Software",
  pristup: "Přístup / účet",
  sit: "Síť",
  jine: "Jiné",
};

export const HELPDESK_PRIORITY_LABELS: Record<string, string> = {
  nizka: "Nízká",
  stredni: "Střední",
  vysoka: "Vysoká",
};

export const HELPDESK_STATUS_LABELS: Record<string, string> = {
  novy: "Nový",
  prirazeno: "Přiřazeno",
  resi_se: "Řeší se",
  vyreseno: "Vyřešeno",
  uzavreno: "Uzavřeno",
};

export const HELPDESK_STATUS_BADGE: Record<string, string> = {
  novy: "bg-amber-100 text-amber-800",
  prirazeno: "bg-blue-100 text-blue-800",
  resi_se: "bg-indigo-100 text-indigo-800",
  vyreseno: "bg-green-100 text-green-800",
  uzavreno: "bg-gray-100 text-gray-700",
};

export const HELPDESK_CATEGORIES = ["hardware", "software", "pristup", "sit", "jine"] as const;
export const HELPDESK_PRIORITIES = ["nizka", "stredni", "vysoka"] as const;
export const HELPDESK_STATUSES = ["novy", "prirazeno", "resi_se", "vyreseno", "uzavreno"] as const;
