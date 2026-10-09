export const SHARED_MACHINE_GROUPS = ["press", "postpress"] as const;
export type SharedMachineGroup = (typeof SHARED_MACHINE_GROUPS)[number];

export const SHARED_MACHINE_GROUP_LABELS: Record<SharedMachineGroup, string> = {
  press: "Press (tisk)",
  postpress: "Postpress",
};

export function isSharedMachineGroup(value: string): value is SharedMachineGroup {
  return (SHARED_MACHINE_GROUPS as readonly string[]).includes(value);
}

/** Heuristika při migraci starých záznamů. */
export function guessMachineGroupFromName(name: string): SharedMachineGroup {
  const n = name.trim().toLowerCase().replace(/\s+/g, "");
  if (n.includes("xl105") || n.includes("xl106") || n.startsWith("xl")) {
    return "press";
  }
  return "postpress";
}
