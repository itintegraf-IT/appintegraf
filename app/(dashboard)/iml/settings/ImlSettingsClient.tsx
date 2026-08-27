"use client";

import { Archive, Box, Droplets, Eraser, Layers, Settings, Wrench } from "lucide-react";
import { Tabs, type TabDef } from "../_components/Tabs";
import { ImlCustomFieldsClient } from "./ImlCustomFieldsClient";
import { ImlFoilSettingsTab } from "./ImlFoilSettingsTab";
import { ImlColorSettingsTab } from "./ImlColorSettingsTab";
import { ImlBoxTypesSettingsTab } from "./ImlBoxTypesSettingsTab";
import { ImlThumbnailBackfillTab } from "./ImlThumbnailBackfillTab";
import { ImlProductArchiveTab } from "./ImlProductArchiveTab";
import { ImlWipePrintAssetsTab } from "./ImlWipePrintAssetsTab";

/**
 * Klientský wrapper pro stránku nastavení IML.
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
      id: "archive",
      label: "Archiv produktů",
      icon: <Archive className="h-4 w-4" />,
      content: <ImlProductArchiveTab />,
      hidden: !canAdmin,
    },
    {
      id: "wipe-assets",
      label: "Mazání souborů",
      icon: <Eraser className="h-4 w-4" />,
      content: <ImlWipePrintAssetsTab />,
      hidden: !canAdmin,
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
