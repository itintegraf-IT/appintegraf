"use client";

import { Droplets, Layers, Settings } from "lucide-react";
import { Tabs, type TabDef } from "../_components/Tabs";
import { ImlCustomFieldsClient } from "./ImlCustomFieldsClient";
import { ImlFoilSettingsTab } from "./ImlFoilSettingsTab";
import { ImlColorSettingsTab } from "./ImlColorSettingsTab";

/**
 * Klientský wrapper pro stránku nastavení IML.
 * Obsahuje 3 záložky:
 *   - custom:  vlastní pole (produkty, objednávky)
 *   - foils:   číselník fólií z katalogu materiálů
 *   - pantone: číselník barev z katalogu materiálů (Pantone / CMYK)
 *
 * Aktivní záložka je v URL (?tab=custom|foils|pantone), aby šel sdílet odkaz.
 */
export function ImlSettingsClient({ canWrite }: { canWrite: boolean }) {
  const tabs: TabDef[] = [
    {
      id: "custom",
      label: "Vlastní pole",
      icon: <Settings className="h-4 w-4" />,
      content: <ImlCustomFieldsClient />,
    },
    {
      id: "foils",
      label: "Fólie",
      icon: <Layers className="h-4 w-4" />,
      content: <ImlFoilSettingsTab canWrite={canWrite} />,
    },
    {
      id: "pantone",
      label: "Barvy",
      icon: <Droplets className="h-4 w-4" />,
      content: <ImlColorSettingsTab canWrite={canWrite} />,
    },
  ];

  return <Tabs tabs={tabs} urlParam="tab" storageKey="imlSettings" />;
}
