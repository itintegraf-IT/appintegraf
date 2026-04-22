"use client";

import { Layers, Settings } from "lucide-react";
import { Tabs, type TabDef } from "../_components/Tabs";
import { ImlCustomFieldsClient } from "./ImlCustomFieldsClient";
import { ImlFoilsClient } from "./ImlFoilsClient";

/**
 * Klientský wrapper pro stránku nastavení IML.
 * Obsahuje 2 záložky:
 *   - custom:  správa vlastních polí (produkty, objednávky)
 *   - foils:   číselník fólií (kód, název, tloušťka, stav)
 *
 * Aktivní záložka je v URL (?tab=custom|foils), aby šel sdílet odkaz.
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
  ];

  return <Tabs tabs={tabs} urlParam="tab" storageKey="imlSettings" />;
}
