import { prisma } from "@/lib/db";
import { EQUIPMENT_ITEM_STATUS } from "@/lib/equipment-status";
import { logEquipmentAuditSafe } from "@/lib/equipment/audit";
import { defaultPlanColor } from "@/lib/equipment/floor-plan";
import {
  allocateUniqueEqQrCodes,
  allocateUniqueRmQrCodes,
} from "@/lib/equipment/qr";
import {
  matchResponsibleUser,
  normalizeCategoryName,
  parseEquipmentExcelBuffer,
  roomDescription,
  uniqueCategoryCode,
  yearToPurchaseDate,
  type ParsedEquipmentItem,
  type ParsedEquipmentWorkbook,
} from "@/lib/equipment/excel-import";

const SAMPLE_LIMIT = 20;

export type EquipmentImportContext = {
  categories: { id: number; name: string; code: string }[];
  rooms: { id: number; code: string; name: string }[];
  assetTags: string[];
  itemQrCodes: string[];
  poolQrCodes: string[];
  roomQrCodes: string[];
  users: { id: number; first_name: string; last_name: string }[];
};

export type PlannedCategory = {
  name: string;
  code: string;
  responsible_user_id: number | null;
  responsibleLabel: string | null;
};

export type PlannedRoom = {
  code: string;
  name: string;
  description: string | null;
};

export type PlannedItem = {
  assetTag: string;
  name: string;
  categoryName: string;
  quantity: number;
  year: number | null;
  location: string | null;
};

export type EquipmentImportPlan = {
  parsed: ParsedEquipmentWorkbook;
  categoriesToCreate: PlannedCategory[];
  categoriesReuse: { id: number; name: string }[];
  roomsToCreate: PlannedRoom[];
  roomsReuse: { id: number; code: string; name: string }[];
  itemsToCreate: ParsedEquipmentItem[];
  itemsToSkip: { assetTag: string; name: string; reason: string }[];
  warnings: string[];
  errors: string[];
  blocked: boolean;
};

export type EquipmentImportPreview = {
  stats: {
    categoriesCreate: number;
    categoriesReuse: number;
    roomsCreate: number;
    roomsReuse: number;
    itemsCreate: number;
    itemsSkip: number;
  };
  categoriesToCreate: PlannedCategory[];
  roomsToCreate: PlannedRoom[];
  itemsSample: PlannedItem[];
  itemsToSkipSample: { assetTag: string; name: string; reason: string }[];
  warnings: string[];
  errors: string[];
  blocked: boolean;
};

export type EquipmentImportCommitResult = {
  categoriesCreated: number;
  roomsCreated: number;
  itemsCreated: number;
  itemsSkipped: number;
  warnings: string[];
};

export async function loadEquipmentImportContext(): Promise<EquipmentImportContext> {
  const [categories, rooms, items, pool, users] = await Promise.all([
    prisma.equipment_categories.findMany({
      select: { id: true, name: true, code: true },
    }),
    prisma.equipment_rooms.findMany({
      select: { id: true, code: true, name: true, qr_code: true },
    }),
    prisma.equipment_items.findMany({
      select: { asset_tag: true, qr_code: true },
    }),
    prisma.equipment_qr_pool.findMany({
      select: { qr_code: true },
    }),
    prisma.users.findMany({
      where: { is_active: true },
      select: { id: true, first_name: true, last_name: true },
    }),
  ]);

  return {
    categories,
    rooms: rooms.map((r) => ({ id: r.id, code: r.code, name: r.name })),
    assetTags: items.map((i) => i.asset_tag).filter((t): t is string => !!t),
    itemQrCodes: items.map((i) => i.qr_code).filter((t): t is string => !!t),
    poolQrCodes: pool.map((p) => p.qr_code),
    roomQrCodes: rooms.map((r) => r.qr_code),
    users,
  };
}

export function buildEquipmentImportPlan(
  parsed: ParsedEquipmentWorkbook,
  ctx: EquipmentImportContext
): EquipmentImportPlan {
  const warnings = [...parsed.warnings];
  const errors = [...parsed.errors];

  const existingCatByName = new Map(
    ctx.categories.map((c) => [normalizeCategoryName(c.name), c])
  );
  const takenCodes = new Set(ctx.categories.map((c) => c.code.toUpperCase()));
  const categoriesToCreate: PlannedCategory[] = [];
  const categoriesReuse: { id: number; name: string }[] = [];

  for (const cat of parsed.categories) {
    const existing = existingCatByName.get(normalizeCategoryName(cat.name));
    if (existing) {
      // Existující skupinu nepřepisujeme (včetně zodpovědné osoby).
      categoriesReuse.push({ id: existing.id, name: existing.name });
      continue;
    }
    const match = matchResponsibleUser(cat.responsibleRaw, ctx.users);
    if (match.warning) warnings.push(`${cat.name}: ${match.warning}`);
    const code = uniqueCategoryCode(cat.name, takenCodes);
    categoriesToCreate.push({
      name: cat.name.slice(0, 100),
      code,
      responsible_user_id: match.userId,
      responsibleLabel: cat.responsibleRaw || null,
    });
  }

  const existingRoomByCode = new Map(
    ctx.rooms.map((r) => [r.code.toUpperCase(), r])
  );
  const roomsToCreate: PlannedRoom[] = [];
  const roomsReuse: { id: number; code: string; name: string }[] = [];
  for (const room of parsed.rooms) {
    const existing = existingRoomByCode.get(room.code.toUpperCase());
    if (existing) {
      roomsReuse.push(existing);
      continue;
    }
    roomsToCreate.push({
      code: room.code,
      name: room.name.slice(0, 150),
      description: roomDescription(room),
    });
  }

  const existingTags = new Set(ctx.assetTags.map((t) => t.toUpperCase()));
  const itemsToCreate: ParsedEquipmentItem[] = [];
  const itemsToSkip: { assetTag: string; name: string; reason: string }[] = [];
  for (const item of parsed.items) {
    if (existingTags.has(item.assetTag.toUpperCase())) {
      itemsToSkip.push({
        assetTag: item.assetTag,
        name: item.name,
        reason: "Inventární číslo už v evidenci existuje",
      });
      continue;
    }
    existingTags.add(item.assetTag.toUpperCase());
    itemsToCreate.push(item);
  }

  const blocked = errors.length > 0 && itemsToCreate.length === 0 && parsed.items.length === 0;

  return {
    parsed,
    categoriesToCreate,
    categoriesReuse,
    roomsToCreate,
    roomsReuse,
    itemsToCreate,
    itemsToSkip,
    warnings,
    errors,
    blocked,
  };
}

export function toEquipmentImportPreview(plan: EquipmentImportPlan): EquipmentImportPreview {
  return {
    stats: {
      categoriesCreate: plan.categoriesToCreate.length,
      categoriesReuse: plan.categoriesReuse.length,
      roomsCreate: plan.roomsToCreate.length,
      roomsReuse: plan.roomsReuse.length,
      itemsCreate: plan.itemsToCreate.length,
      itemsSkip: plan.itemsToSkip.length,
    },
    categoriesToCreate: plan.categoriesToCreate,
    roomsToCreate: plan.roomsToCreate,
    itemsSample: plan.itemsToCreate.slice(0, SAMPLE_LIMIT).map((i) => ({
      assetTag: i.assetTag,
      name: i.name,
      categoryName: i.categoryName,
      quantity: i.quantity,
      year: i.year,
      location: i.location,
    })),
    itemsToSkipSample: plan.itemsToSkip.slice(0, SAMPLE_LIMIT),
    warnings: plan.warnings,
    errors: plan.errors,
    blocked: plan.blocked,
  };
}

export function planFromExcelBuffer(
  buf: Buffer | Uint8Array,
  ctx: EquipmentImportContext
): EquipmentImportPlan {
  return buildEquipmentImportPlan(parseEquipmentExcelBuffer(buf), ctx);
}

export async function commitEquipmentImportWithContext(
  plan: EquipmentImportPlan,
  ctx: EquipmentImportContext,
  userId: number
): Promise<EquipmentImportCommitResult> {
  if (plan.blocked) {
    throw new Error(plan.errors[0] || "Soubor nelze importovat");
  }

  const eqQrCodes = allocateUniqueEqQrCodes(plan.itemsToCreate.length, [
    ...ctx.itemQrCodes,
    ...ctx.poolQrCodes,
  ]);
  const rmQrCodes = allocateUniqueRmQrCodes(plan.roomsToCreate.length, ctx.roomQrCodes);

  await prisma.$transaction(
    async (tx) => {
      const categoryIdByName = new Map<string, number>();
      for (const c of ctx.categories) {
        categoryIdByName.set(normalizeCategoryName(c.name), c.id);
      }

      for (const cat of plan.categoriesToCreate) {
        const row = await tx.equipment_categories.create({
          data: {
            name: cat.name,
            code: cat.code,
            responsible_user_id: cat.responsible_user_id,
            is_active: true,
          },
        });
        categoryIdByName.set(normalizeCategoryName(cat.name), row.id);
      }

      for (let i = 0; i < plan.roomsToCreate.length; i++) {
        const room = plan.roomsToCreate[i];
        await tx.equipment_rooms.create({
          data: {
            name: room.name,
            code: room.code,
            description: room.description,
            qr_code: rmQrCodes[i],
            is_active: true,
            plan_color: defaultPlanColor(room.code),
          },
        });
      }

      const missingCategory = plan.itemsToCreate.find(
        (item) => !categoryIdByName.has(normalizeCategoryName(item.categoryName))
      );
      if (missingCategory) {
        throw new Error(`Chybí skupina majetku: ${missingCategory.categoryName}`);
      }

      if (plan.itemsToCreate.length > 0) {
        await tx.equipment_items.createMany({
          data: plan.itemsToCreate.map((item, i) => ({
            name: item.name,
            asset_tag: item.assetTag,
            qr_code: eqQrCodes[i],
            category_id: categoryIdByName.get(normalizeCategoryName(item.categoryName))!,
            purchase_date: yearToPurchaseDate(item.year),
            quantity: item.quantity,
            status: EQUIPMENT_ITEM_STATUS.SKLADEM,
            location: item.location,
            notes: item.notes,
            room_id: null,
          })),
        });
      }
    },
    { timeout: 120_000 }
  );

  await logEquipmentAuditSafe({
    userId,
    action: "excel_import",
    tableName: "equipment_items",
    detail: {
      categoriesCreated: plan.categoriesToCreate.length,
      roomsCreated: plan.roomsToCreate.length,
      itemsCreated: plan.itemsToCreate.length,
      itemsSkipped: plan.itemsToSkip.length,
    },
  });

  return {
    categoriesCreated: plan.categoriesToCreate.length,
    roomsCreated: plan.roomsToCreate.length,
    itemsCreated: plan.itemsToCreate.length,
    itemsSkipped: plan.itemsToSkip.length,
    warnings: plan.warnings,
  };
}
