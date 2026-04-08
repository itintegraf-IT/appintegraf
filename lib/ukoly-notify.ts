import { prisma } from "@/lib/db";
import { sendUkolEmail } from "@/lib/email";
import { collectUkolNotifyUserIds } from "@/lib/ukoly-recipients";

export type UkolNotifyKind = "assigned" | "deadline_changed";

export async function notifyUkolRecipients(params: {
  ukolId: number;
  bodyPreview: string;
  orderNumber: string | null;
  kind: UkolNotifyKind;
  assigneeUserId: number | null;
  departmentIds: number[];
}): Promise<void> {
  const ids = await collectUkolNotifyUserIds(params.assigneeUserId, params.departmentIds);
  if (ids.length === 0) return;

  const linkPath = `/ukoly/${params.ukolId}`;
  const title =
    params.kind === "assigned" ? "Nový úkol" : "Změna termínu úkolu";
  const message =
    params.kind === "assigned"
      ? `Byl vám přidělen úkol${params.orderNumber ? ` (zakázka ${params.orderNumber})` : ""}.`
      : `U úkolu${params.orderNumber ? ` (zakázka ${params.orderNumber})` : ""} byl změněn termín splnění.`;

  const type =
    params.kind === "assigned" ? "ukoly_assigned" : "ukoly_deadline_changed";

  const users = await prisma.users.findMany({
    where: { id: { in: ids } },
    select: { id: true, email: true, first_name: true, last_name: true },
  });

  for (const uid of ids) {
    await prisma.notifications.create({
      data: {
        user_id: uid,
        title,
        message: `${message} ${params.bodyPreview.slice(0, 200)}`,
        type,
        link: linkPath,
      },
    });
  }

  for (const u of users) {
    if (!u.email) continue;
    await sendUkolEmail({
      toEmail: u.email,
      toName: `${u.first_name} ${u.last_name}`.trim() || "Uživateli",
      subject:
        params.kind === "assigned"
          ? "Nový úkol – INTEGRAF"
          : "Změna termínu úkolu – INTEGRAF",
      intro: message,
      bodyPreview: params.bodyPreview,
      orderNumber: params.orderNumber,
      ukolId: params.ukolId,
    });
  }
}

export async function notifyUkolDone(params: {
  ukolId: number;
  doneByUserId: number;
  creatorUserId: number;
  bodyPreview: string;
  orderNumber: string | null;
}): Promise<void> {
  if (params.creatorUserId === params.doneByUserId) return;

  const doneBy = await prisma.users.findUnique({
    where: { id: params.doneByUserId },
    select: { first_name: true, last_name: true },
  });
  const doneByName = doneBy ? `${doneBy.first_name} ${doneBy.last_name}`.trim() : "Uživatel";
  const message = `${doneByName} označil/a úkol jako splněný${params.orderNumber ? ` (zakázka ${params.orderNumber})` : ""}.`;

  await prisma.notifications.create({
    data: {
      user_id: params.creatorUserId,
      title: "Úkol splněn",
      message,
      type: "ukoly_done",
      link: `/ukoly/${params.ukolId}`,
    },
  });

  const creator = await prisma.users.findUnique({
    where: { id: params.creatorUserId },
    select: { email: true, first_name: true, last_name: true },
  });
  if (!creator?.email) return;

  await sendUkolEmail({
    toEmail: creator.email,
    toName: `${creator.first_name} ${creator.last_name}`.trim() || "Uživateli",
    subject: "Úkol splněn – INTEGRAF",
    intro: message,
    bodyPreview: params.bodyPreview,
    orderNumber: params.orderNumber,
    ukolId: params.ukolId,
  });
}
