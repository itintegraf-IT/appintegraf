"use client";

import { useState } from "react";
import { ImlCustomFieldsClient } from "./ImlCustomFieldsClient";
import { ImlFoilSettingsTab } from "./ImlFoilSettingsTab";
import { ImlColorSettingsTab } from "./ImlColorSettingsTab";

type MainTab = "fields" | "foils" | "colors";

const tabs: { id: MainTab; label: string }[] = [
  { id: "fields", label: "Vlastní pole" },
  { id: "foils", label: "Fólie" },
  { id: "colors", label: "Barvy" },
];

export function ImlSettingsTabsClient({ canWrite }: { canWrite: boolean }) {
  const [tab, setTab] = useState<MainTab>("fields");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-white text-red-700 ring-1 ring-gray-200 ring-b-0"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "fields" && <ImlCustomFieldsClient />}
      {tab === "foils" && <ImlFoilSettingsTab canWrite={canWrite} />}
      {tab === "colors" && <ImlColorSettingsTab canWrite={canWrite} />}
    </div>
  );
}
