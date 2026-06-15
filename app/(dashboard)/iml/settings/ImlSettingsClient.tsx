"use client";

import { Droplets, Layers, Settings, Wrench } from "lucide-react";
import { Tabs, type TabDef } from "../_components/Tabs";
import { ImlCustomFieldsClient } from "./ImlCustomFieldsClient";
import { ImlFoilSettingsTab } from "./ImlFoilSettingsTab";
import { ImlColorSettingsTab } from "./ImlColorSettingsTab";
import { ImlThumbnailBackfillTab } from "./ImlThumbnailBackfillTab";

/**
 * Klientský wrapper pro stránku nastavení IML.
 * Obsahuje 3 záložky:
 *   - custom:  vlastní pole (produkty, objednávky)
 *   - foils:   číselník fólií z katalogu materiálů
 *   - pantone: číselník barev z katalogu materiálů (Pantone / CMYK)
 *
 * Aktivní záložka je v URL (?tab=custom|foils|pantone), aby šel sdílet odkaz.
 */
export function ImlSettingsClient({
  canWrite,
  canAdmin = false,
}: {
  canWrite: boolean;
  canAdmin?: boolean;
}) {
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
    {
      id: "maintenance",
      label: "Údržba",
      icon: <Wrench className="h-4 w-4" />,
      content: <ImlThumbnailBackfillTab />,
      hidden: !canAdmin,
    },
  ];

  return <Tabs tabs={tabs} urlParam="tab" storageKey="imlSettings" />;
}
