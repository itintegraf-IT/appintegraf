import { prisma } from "@/lib/db";
import { collectMaketaNotifyUserIds } from "@/lib/makety-recipients";

export type MaketaNotifyKind =
  | "assigned"
  | "deadline_changed"
  | "done"
  | "comment"
  | "quote_submitted"
  | "quote_approved"
  | "quote_rejected";

async function notifyMaketaUser(
  userId: number,
  params: {
    maketaId: number;
    title: string;
    message: string;
    type: string;
  }
): Promise<void> {
  await prisma.notifications.create({
    data: {
      user_id: userId,
      title: params.title,
      message: params.message,
      type: params.type,
      link: `/makety/${params.maketaId}`,
    },
  });
}

export async function notifyMaketaRecipients(params: {
  maketaId: number;
  bodyPreview: string;
  orderNumber: string | null;
  kind: MaketaNotifyKind;
  assigneeUserId: number | null;
  excludeUserId?: number;
}): Promise<void> {
  const ids = await collectMaketaNotifyUserIds(params.assigneeUserId, params.excludeUserId);
  if (ids.length === 0) return;

  const linkPath = `/makety/${params.maketaId}`;
  const titleByKind: Record<MaketaNotifyKind, string> = {
    assigned: "Nová maketa",
    deadline_changed: "Změna termínu makety",
    done: "Maketa dokončena",
    comment: "Nový komentář k maketě",
    quote_submitted: "Nabídka k maketě",
    quote_approved: "Maketa schválena",
    quote_rejected: "Nabídka zamítnuta",
  };
  const messageByKind: Record<MaketaNotifyKind, string> = {
    assigned: `Byla vám přidělena maketa${params.orderNumber ? ` (zakázka ${params.orderNumber})` : ""}.`,
    deadline_changed: `U makety${params.orderNumber ? ` (zakázka ${params.orderNumber})` : ""} byl změněn termín.`,
    done: `Maketa${params.orderNumber ? ` (zakázka ${params.orderNumber})` : ""} byla označena jako hotová.`,
    comment: `U makety${params.orderNumber ? ` (zakázka ${params.orderNumber})` : ""} byl přidán komentář.`,
    quote_submitted: `Výrobce odeslal nabídku k maketě${params.orderNumber ? ` (zakázka ${params.orderNumber})` : ""}.`,
    quote_approved: `Zadavatel schválil maketu do výroby${params.orderNumber ? ` (zakázka ${params.orderNumber})` : ""}.`,
    quote_rejected: `Zadavatel zamítl nabídku k maketě${params.orderNumber ? ` (zakázka ${params.orderNumber})` : ""}.`,
  };

  const type = `makety_${params.kind}`;

  for (const uid of ids) {
    await prisma.notifications.create({
      data: {
        user_id: uid,
        title: titleByKind[params.kind],
        message: `${messageByKind[params.kind]} ${params.bodyPreview.slice(0, 200)}`,
        type,
        link: linkPath,
      },
    });
  }
}

export async function notifyMaketaCreator(params: {
  maketaId: number;
  creatorUserId: number;
  title: string;
  message: string;
  type: string;
}): Promise<void> {
  await notifyMaketaUser(params.creatorUserId, {
    maketaId: params.maketaId,
    title: params.title,
    message: params.message,
    type: params.type,
  });
}

export async function notifyMaketaQuoteSubmitted(params: {
  maketaId: number;
  creatorUserId: number;
  orderNumber: string | null;
  bodyPreview: string;
}): Promise<void> {
  await notifyMaketaCreator({
    maketaId: params.maketaId,
    creatorUserId: params.creatorUserId,
    title: "Nabídka k maketě",
    message: `Výrobce odeslal cenu a popis výroby${params.orderNumber ? ` (zakázka ${params.orderNumber})` : ""}. ${params.bodyPreview.slice(0, 150)}`,
    type: "makety_quote_submitted",
  });
}

export async function notifyMaketaDone(params: {
  maketaId: number;
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
  const message = `${doneByName} označil/a maketu jako hotovou${params.orderNumber ? ` (zakázka ${params.orderNumber})` : ""}.`;

  await prisma.notifications.create({
    data: {
      user_id: params.creatorUserId,
      title: "Maketa dokončena",
      message,
      type: "makety_done",
      link: `/makety/${params.maketaId}`,
    },
  });
}
