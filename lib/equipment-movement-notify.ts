import { prisma } from "@/lib/db";
import { sendEquipmentMovementEmail } from "@/lib/email";
import { getDepartmentMembers } from "@/lib/equipment-departments";
import { getExtraMovementNotifyUserIds } from "@/lib/equipment/movement-extra-recipients";
import {
  filterUserIdsAllowingEmail,
} from "@/lib/user-email-notifications-db";

/** Oddělení, které dostává info o pohybech majetku (název nebo kód v DB). */
export const EQUIPMENT_ACCOUNTING_DEPARTMENT = "Účtárna";

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

async function collectRecipients(holderUserId: number | null): Promise<Recipient[]> {
  const byId = new Map<number, Recipient>();

  if (holderUserId != null) {
    for (const u of await loadUsersByIds([holderUserId])) {
      byId.set(u.id, u);
    }
  }

  try {
    const accounting = await getDepartmentMembers(EQUIPMENT_ACCOUNTING_DEPARTMENT);
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
    const recipients = await collectRecipients(params.holderUserId);

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
    const recipients = await collectRecipients(params.formerHolderUserId);

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
    const recipients = await collectRecipients(activeAssignment?.user_id ?? null);

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
