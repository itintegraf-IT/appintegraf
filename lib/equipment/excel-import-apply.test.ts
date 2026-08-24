import { describe, expect, it } from "vitest";
import {
  buildEquipmentImportPlan,
  type EquipmentImportContext,
} from "@/lib/equipment/excel-import-apply";
import type { ParsedEquipmentWorkbook } from "@/lib/equipment/excel-import";

const emptyCtx = (): EquipmentImportContext => ({
  categories: [{ id: 1, name: "Auta", code: "AUTA" }],
  rooms: [{ id: 10, code: "1001", name: "Recepce" }],
  assetTags: ["88091"],
  itemQrCodes: [],
  poolQrCodes: [],
  roomQrCodes: [],
  users: [{ id: 5, first_name: "Michal", last_name: "Osoba" }],
});

describe("buildEquipmentImportPlan", () => {
  it("přeskočí existující asset_tag a znovupoužije kategorii i místnost", () => {
    const parsed: ParsedEquipmentWorkbook = {
      categories: [
        { name: "Auta", responsibleRaw: "Sychrovský" },
        { name: "AV technika", responsibleRaw: "Osoba Michal" },
      ],
      rooms: [
        { code: "1001", name: "Recepce hlavní vstup", aliases: [] },
        { code: "1020", name: "Hala IG1", aliases: [] },
      ],
      items: [
        {
          rowNumber: 2,
          assetTag: "88091",
          name: "Existující",
          categoryName: "Auta",
          year: 2017,
          quantity: 1,
          originalRoomName: "",
          originalRoomCode: "",
          workerName: "",
          costCenter: "",
          extra: "",
          location: null,
          notes: null,
        },
        {
          rowNumber: 3,
          assetTag: "42",
          name: "Nový",
          categoryName: "AV technika",
          year: 2020,
          quantity: 2,
          originalRoomName: "Hala",
          originalRoomCode: "1020",
          workerName: "",
          costCenter: "Výroba",
          extra: "",
          location: "Hala (1020)",
          notes: "Středisko: Výroba",
        },
      ],
      warnings: [],
      errors: [],
    };

    const plan = buildEquipmentImportPlan(parsed, emptyCtx());
    expect(plan.itemsToSkip).toHaveLength(1);
    expect(plan.itemsToSkip[0].assetTag).toBe("88091");
    expect(plan.itemsToCreate).toHaveLength(1);
    expect(plan.itemsToCreate[0].assetTag).toBe("42");
    expect(plan.categoriesReuse.map((c) => c.name)).toEqual(["Auta"]);
    expect(plan.categoriesToCreate.map((c) => c.name)).toEqual(["AV technika"]);
    expect(plan.categoriesToCreate[0].responsible_user_id).toBe(5);
    expect(plan.roomsReuse.map((r) => r.code)).toEqual(["1001"]);
    expect(plan.roomsToCreate.map((r) => r.code)).toEqual(["1020"]);
    expect(plan.blocked).toBe(false);
  });
});
