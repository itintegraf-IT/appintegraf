"use client";

import { Box, Droplets, Layers, Settings, Wrench } from "lucide-react";
import { Tabs, type TabDef } from "../_components/Tabs";
import { ImlCustomFieldsClient } from "./ImlCustomFieldsClient";
import { ImlFoilSettingsTab } from "./ImlFoilSettingsTab";
import { ImlColorSettingsTab } from "./ImlColorSettingsTab";
import { ImlBoxTypesSettingsTab } from "./ImlBoxTypesSettingsTab";
import { ImlThumbnailBackfillTab } from "./ImlThumbnailBackfillTab";

/**
 * Klientský wrapper pro stránku nastavení IML.
 * Obsahuje záložky:
 *   - custom:  vlastní pole (produkty, objednávky)
 *   - foils:   číselník fólií z katalogu materiálů
 *   - pantone: číselník barev z katalogu materiálů (Pantone / CMYK)
 *   - boxes:   typy krabic pro výseky
 *
 * Aktivní záložka je v URL (?tab=…), aby šel sdílet odkaz.
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
      id: "boxes",
      label: "Typy krabic",
      icon: <Box className="h-4 w-4" />,
      content: <ImlBoxTypesSettingsTab canWrite={canWrite} />,
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
