import { prisma } from "@/lib/db";
import { sendEquipmentMovementEmail } from "@/lib/email";
import { getDepartmentMembers } from "@/lib/equipment-departments";
import { getExtraMovementNotifyUserIds } from "@/lib/equipment/movement-extra-recipients";
import { unitsLabel } from "@/lib/equipment/new-item-validation";
import {
  filterUserIdsAllowingEmail,
} from "@/lib/user-email-notifications-db";

/** Oddělení, které dostává info o pohybech majetku — kód oddělení „Účetnictví“ (hledá se název i kód). */
export const EQUIPMENT_ACCOUNTING_DEPARTMENT = "ACC";

type Recipient = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
};

async function loadUsersByIds(ids: number[]): Promise<Recipient[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.users.findMany({
    where: { id: { in: ids }, is_active: true },
    select: { id: true, email: true, first_name: true, last_name: true },
  });
  return rows.map((u) => ({
    id: u.id,
    email: u.email ?? "",
    first_name: u.first_name,
    last_name: u.last_name,
  }));
}

/** Příjemci notifikace o pohybu: držitel, účtárna a další příjemci z nastavení (bez duplicit). */
export async function collectMovementRecipients(holderUserId: number | null): Promise<Recipient[]> {
  const byId = new Map<number, Recipient>();

  if (holderUserId != null) {
    for (const u of await loadUsersByIds([holderUserId])) {
      byId.set(u.id, u);
    }
  }

  try {
    const accounting = await getDepartmentMembers(EQUIPMENT_ACCOUNTING_DEPARTMENT);
    if (accounting.length === 0) {
      console.warn("equipment-movement-notify: oddělení Účetnictví (ACC) nemá žádné členy — účtárna notifikaci nedostane");
    }
    for (const u of accounting) {
      if (!byId.has(u.id)) {
        byId.set(u.id, {
          id: u.id,
          email: u.email ?? "",
          first_name: u.first_name,
          last_name: u.last_name,
        });
      }
    }
  } catch (e) {
    console.error("equipment-movement-notify: účtárna recipients failed:", e);
  }

  try {
    const extraIds = await getExtraMovementNotifyUserIds();
    const missing = extraIds.filter((id) => !byId.has(id));
    for (const u of await loadUsersByIds(missing)) {
      byId.set(u.id, u);
    }
  } catch (e) {
    console.error("equipment-movement-notify: extra recipients failed:", e);
  }

  return [...byId.values()];
}

async function notifyRecipients(params: {
  recipients: Recipient[];
  title: string;
  message: string;
  type: string;
  link: string;
  emailSubject: string;
  emailIntro: string;
  protocolLabel: string;
}): Promise<void> {
  if (params.recipients.length === 0) return;

  for (const r of params.recipients) {
    await prisma.notifications.create({
      data: {
        user_id: r.id,
        title: params.title,
        message: params.message,
        type: params.type,
        link: params.link,
      },
    });
  }

  const emailIds = new Set(
    await filterUserIdsAllowingEmail(
      params.recipients.map((r) => r.id),
      "equipment"
    )
  );

  for (const r of params.recipients) {
    if (!emailIds.has(r.id) || !r.email?.trim()) continue;
    const toName = `${r.first_name} ${r.last_name}`.trim() || "Uživateli";
    const result = await sendEquipmentMovementEmail({
      toEmail: r.email.trim(),
      toName,
      subject: params.emailSubject,
      intro: params.emailIntro,
      protocolPath: params.link,
      protocolLabel: params.protocolLabel,
    });
    if (!result.success && result.error) {
      console.error(
        `equipment-movement-notify: e-mail pro user ${r.id} se nepodařil: ${result.error}`
      );
    }
  }
}

function equipmentLabel(name: string, extras?: { brand?: string | null; model?: string | null }) {
  const parts = [name];
  if (extras?.brand?.trim()) parts.push(extras.brand.trim());
  if (extras?.model?.trim()) parts.push(extras.model.trim());
  return parts.join(" ");
}

/** Po přiřazení majetku uživateli — držitel + účtárna. */
export async function notifyEquipmentAssigned(params: {
  assignmentId: number;
  equipmentId: number;
  holderUserId: number;
}): Promise<void> {
  try {
    const item = await prisma.equipment_items.findUnique({
      where: { id: params.equipmentId },
      select: { name: true, brand: true, model: true },
    });
    if (!item) return;

    const label = equipmentLabel(item.name, item);
    const link = `/equipment/protokol/predani?assignmentId=${params.assignmentId}`;
    const recipients = await collectMovementRecipients(params.holderUserId);

    await notifyRecipients({
      recipients,
      title: "Přidělení majetku",
      message: `Byl přidělen majetek „${label}“.`,
      type: "equipment_assigned",
      link,
      emailSubject: `Přidělení majetku – ${label} – INTEGRAF`,
      emailIntro: `Byl přidělen majetek „${label}“. Protokol o předání otevřete odkazem níže.`,
      protocolLabel: "Otevřít předávací protokol",
    });
  } catch (e) {
    console.error("notifyEquipmentAssigned error:", e);
  }
}

/** Po vrácení / odebrání majetku — bývalý držitel + účtárna. */
export async function notifyEquipmentReturned(params: {
  assignmentId: number;
  equipmentId: number;
  formerHolderUserId: number;
}): Promise<void> {
  try {
    const item = await prisma.equipment_items.findUnique({
      where: { id: params.equipmentId },
      select: { name: true, brand: true, model: true },
    });
    if (!item) return;

    const label = equipmentLabel(item.name, item);
    const link = `/equipment/protokol/vraceni?assignmentId=${params.assignmentId}`;
    const recipients = await collectMovementRecipients(params.formerHolderUserId);

    await notifyRecipients({
      recipients,
      title: "Vrácení majetku",
      message: `Byl vrácen majetek „${label}“.`,
      type: "equipment_returned",
      link,
      emailSubject: `Vrácení majetku – ${label} – INTEGRAF`,
      emailIntro: `Byl vrácen majetek „${label}“. Protokol o vrácení otevřete odkazem níže.`,
      protocolLabel: "Otevřít protokol o vrácení",
    });
  } catch (e) {
    console.error("notifyEquipmentReturned error:", e);
  }
}

function roomLabel(room: { code: string | null; name: string } | null): string {
  if (!room) return "—";
  return [room.code, room.name].filter(Boolean).join(" – ") || room.name;
}

/** „Židle A, Židle B a další 3“ — výčet do souhrnné notifikace. */
function itemsSummary(labels: string[], max = 5): string {
  if (labels.length <= max) return labels.join(", ");
  return `${labels.slice(0, max).join(", ")} a další ${labels.length - max}`;
}

async function loadItemLabels(equipmentIds: number[]): Promise<(ids: number[]) => string> {
  const items = await prisma.equipment_items.findMany({
    where: { id: { in: equipmentIds } },
    select: { id: true, name: true, brand: true, model: true },
  });
  const labelOf = new Map(items.map((i) => [i.id, equipmentLabel(i.name, i)]));
  return (ids) => itemsSummary(ids.map((id) => labelOf.get(id) ?? `#${id}`));
}

/**
 * Hromadná akce: účtárna a další příjemci dostanou jednu souhrnnou notifikaci o všech kusech,
 * každý držitel jednu o svých kusech (kdo je v obou skupinách, dostane jen souhrn).
 */
async function notifyBulk(
  equipmentIds: number[],
  holderByItem: Map<number, number>,
  send: (recipients: Recipient[], equipmentIds: number[]) => Promise<void>
): Promise<void> {
  const office = await collectMovementRecipients(null);
  await send(office, equipmentIds);

  const officeIds = new Set(office.map((r) => r.id));
  const byHolder = new Map<number, number[]>();
  for (const id of equipmentIds) {
    const holderId = holderByItem.get(id);
    if (holderId == null || officeIds.has(holderId)) continue;
    byHolder.set(holderId, [...(byHolder.get(holderId) ?? []), id]);
  }
  for (const [holderId, ids] of byHolder) {
    await send(await loadUsersByIds([holderId]), ids);
  }
}

/** Hromadný přesun do místnosti — jedna notifikace na příjemce místo jedné za každý kus. */
export async function notifyEquipmentRoomTransferBulk(params: {
  transfers: { historyId: number; equipmentId: number }[];
  toRoomId: number;
}): Promise<void> {
  try {
    if (params.transfers.length === 0) return;
    const equipmentIds = params.transfers.map((t) => t.equipmentId);
    const [describe, toRoom, assignments] = await Promise.all([
      loadItemLabels(equipmentIds),
      prisma.equipment_rooms.findUnique({ where: { id: params.toRoomId }, select: { code: true, name: true } }),
      prisma.equipment_assignments.findMany({
        where: { equipment_id: { in: equipmentIds }, returned_at: null },
        select: { equipment_id: true, user_id: true },
      }),
    ]);
    const toLabel = roomLabel(toRoom);

    await notifyBulk(
      equipmentIds,
      new Map(assignments.map((a) => [a.equipment_id, a.user_id])),
      (recipients, ids) => {
        const message = `Do místnosti „${toLabel}“ přesunuto ${unitsLabel(ids.length)} majetku: ${describe(ids)}.`;
        return notifyRecipients({
          recipients,
          title: "Hromadný přesun majetku",
          message,
          type: "equipment_room_transfer",
          link: `/equipment/rooms/${params.toRoomId}`,
          emailSubject: `Přesun majetku – ${unitsLabel(ids.length)} do ${toLabel} – INTEGRAF`,
          emailIntro: `${message} Kusy v místnosti a protokoly o přesunu otevřete odkazem níže.`,
          protocolLabel: "Otevřít místnost",
        });
      }
    );
  } catch (e) {
    console.error("notifyEquipmentRoomTransferBulk error:", e);
  }
}

/** Hromadné přiřazení jednomu držiteli — jedna notifikace na příjemce. */
export async function notifyEquipmentAssignedBulk(params: {
  equipmentIds: number[];
  holderUserId: number;
}): Promise<void> {
  try {
    if (params.equipmentIds.length === 0) return;
    const [describe, holders] = await Promise.all([
      loadItemLabels(params.equipmentIds),
      loadUsersByIds([params.holderUserId]),
    ]);
    const holderName = holders[0] ? `${holders[0].first_name} ${holders[0].last_name}`.trim() : "uživateli";

    await notifyBulk(
      params.equipmentIds,
      new Map(params.equipmentIds.map((id) => [id, params.holderUserId])),
      (recipients, ids) => {
        const message = `Uživateli ${holderName} přiděleno ${unitsLabel(ids.length)} majetku: ${describe(ids)}.`;
        return notifyRecipients({
          recipients,
          title: "Přidělení majetku",
          message,
          type: "equipment_assigned",
          link: "/equipment/prirazeni",
          emailSubject: `Přidělení majetku – ${unitsLabel(ids.length)} – INTEGRAF`,
          emailIntro: `${message} Předávací protokoly vytisknete v přehledu přiřazení.`,
          protocolLabel: "Otevřít přehled přiřazení",
        });
      }
    );
  } catch (e) {
    console.error("notifyEquipmentAssignedBulk error:", e);
  }
}

/** Po přesunu mezi místnostmi — aktivní držitel (pokud je) + účtárna. */
export async function notifyEquipmentRoomTransfer(params: {
  historyId: number;
  equipmentId: number;
  fromRoomId: number | null;
  toRoomId: number;
  protocolNumber?: string | null;
}): Promise<void> {
  try {
    const item = await prisma.equipment_items.findUnique({
      where: { id: params.equipmentId },
      select: { name: true, brand: true, model: true },
    });
    if (!item) return;

    const [fromRoom, toRoom, activeAssignment] = await Promise.all([
      params.fromRoomId
        ? prisma.equipment_rooms.findUnique({
            where: { id: params.fromRoomId },
            select: { code: true, name: true },
          })
        : Promise.resolve(null),
      prisma.equipment_rooms.findUnique({
        where: { id: params.toRoomId },
        select: { code: true, name: true },
      }),
      prisma.equipment_assignments.findFirst({
        where: { equipment_id: params.equipmentId, returned_at: null },
        select: { user_id: true },
      }),
    ]);

    const label = equipmentLabel(item.name, item);
    const fromLabel = roomLabel(fromRoom);
    const toLabel = roomLabel(toRoom);
    const link = `/equipment/protokol/presun-mistnosti?historyId=${params.historyId}`;
    const recipients = await collectMovementRecipients(activeAssignment?.user_id ?? null);

    const protocolHint = params.protocolNumber ? ` (${params.protocolNumber})` : "";
    const message = `Majetek „${label}“ přesunut z „${fromLabel}“ do „${toLabel}“${protocolHint}.`;

    await notifyRecipients({
      recipients,
      title: "Přesun majetku",
      message,
      type: "equipment_room_transfer",
      link,
      emailSubject: `Přesun majetku – ${label} – INTEGRAF`,
      emailIntro: `${message} Protokol o přesunu otevřete odkazem níže.`,
      protocolLabel: "Otevřít protokol o přesunu",
    });
  } catch (e) {
    console.error("notifyEquipmentRoomTransfer error:", e);
  }
}
