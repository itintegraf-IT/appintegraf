import { prisma } from "@/lib/db";
import { collectMaketaNotifyUserIds } from "@/lib/makety-recipients";

export type MaketaNotifyKind = "assigned" | "deadline_changed" | "done" | "comment";

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
  };
  const messageByKind: Record<MaketaNotifyKind, string> = {
    assigned: `Byla vám přidělena maketa${params.orderNumber ? ` (zakázka ${params.orderNumber})` : ""}.`,
    deadline_changed: `U makety${params.orderNumber ? ` (zakázka ${params.orderNumber})` : ""} byl změněn termín.`,
    done: `Maketa${params.orderNumber ? ` (zakázka ${params.orderNumber})` : ""} byla označena jako hotová.`,
    comment: `U makety${params.orderNumber ? ` (zakázka ${params.orderNumber})` : ""} byl přidán komentář.`,
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
