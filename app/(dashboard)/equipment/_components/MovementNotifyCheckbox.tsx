"use client";

import { useState } from "react";

const STORAGE_KEY = "equipment-movement-notify";

function readPreference(): boolean {
  try {
    return typeof window === "undefined" || window.sessionStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

/**
 * Volba „poslat notifikaci o pohybu“ zapamatovaná pro relaci prohlížeče — terénní obrazovky
 * se neptají druhým oknem (window.confirm) u každého kusu.
 */
export function useMovementNotifyPreference(): [boolean, (value: boolean) => void] {
  const [notify, setNotify] = useState(readPreference);
  const update = (value: boolean) => {
    setNotify(value);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      /* soukromé okno — volba platí jen do obnovení stránky */
    }
  };
  return [notify, update];
}

export function MovementNotifyCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 shrink-0"
      />
      Poslat notifikaci držiteli a účtárně (aplikace + e-mail)
    </label>
  );
}
