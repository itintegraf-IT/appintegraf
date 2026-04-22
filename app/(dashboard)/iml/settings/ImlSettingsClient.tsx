"use client";

import { Droplets, Layers, Settings } from "lucide-react";
import { Tabs, type TabDef } from "../_components/Tabs";
import { ImlCustomFieldsClient } from "./ImlCustomFieldsClient";
import { ImlFoilsClient } from "./ImlFoilsClient";
import { ImlPantoneColorsClient } from "./ImlPantoneColorsClient";

/**
 * Klientský wrapper pro stránku nastavení IML.
 * Obsahuje 3 záložky:
 *   - custom:  vlastní pole (produkty, objednávky)
 *   - foils:   číselník fólií (kód, název, tloušťka, stav)
 *   - pantone: číselník Pantone barev (kód, název, HEX, stav)
 *
 * Aktivní záložka je v URL (?tab=custom|foils|pantone), aby šel sdílet odkaz.
 */
export function ImlSettingsClient() {
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
      content: <ImlFoilsClient />,
    },
    {
      id: "pantone",
      label: "Pantone",
      icon: <Droplets className="h-4 w-4" />,
      content: <ImlPantoneColorsClient />,
    },
  ];

  return <Tabs tabs={tabs} urlParam="tab" storageKey="imlSettings" />;
}
