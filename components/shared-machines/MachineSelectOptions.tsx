"use client";

import {
  SHARED_MACHINE_GROUPS,
  SHARED_MACHINE_GROUP_LABELS,
  type SharedMachineGroup,
} from "@/lib/shared-machines/constants";

export type MachineOption = {
  id: number;
  name: string;
  machine_group?: string;
};

/** Optgroup options press / postpress for shared machine selects. */
export function MachineSelectOptions({ machines }: { machines: MachineOption[] }) {
  return (
    <>
      {SHARED_MACHINE_GROUPS.map((g) => {
        const list = machines.filter(
          (m) =>
            m.machine_group === g ||
            (!m.machine_group && g === "postpress")
        );
        if (list.length === 0) return null;
        return (
          <optgroup key={g} label={SHARED_MACHINE_GROUP_LABELS[g as SharedMachineGroup]}>
            {list.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </optgroup>
        );
      })}
    </>
  );
}
