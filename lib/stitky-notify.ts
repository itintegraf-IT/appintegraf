import { prisma } from "@/lib/db";
import {
  collectStitkyNotifyUserIds,
  type StitkyNotifyChannel,
} from "@/lib/stitky/recipients";

async function actorDisplayName(userId: number): Promise<string> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { first_name: true, last_name: true, username: true },
  });
  if (!user) return "Uživatel";
  const name = `${user.first_name} ${user.last_name}`.trim();
  return name || user.username;
}

/** In-app notifikace tiskařům / mistrům při zadání zakázky do výroby. */
export async function notifyStitkySubmittedToRoles(params: {
  orderId: number;
  orderNumber: string;
  submittedByUserId: number;
  submittedByName: string;
  channel: StitkyNotifyChannel;
}): Promise<void> {
  const userIds = await collectStitkyNotifyUserIds({
    channel: params.channel,
    excludeUserId: params.submittedByUserId,
  });

  const title =
    params.channel === "mailing" ? "Nová zakázka štítků (mailing)" : "Nová zakázka štítků (mistry)";

  for (const userId of userIds) {
    await prisma.notifications.create({
      data: {
        user_id: userId,
        title,
        message: `${params.submittedByName} zadal/a zakázku ${params.orderNumber} do výroby.`,
        type: params.channel === "mailing" ? "stitky_submitted" : "stitky_submitted_mistri",
        link: `/stitky/${params.orderId}`,
      },
    });
  }
}

export async function notifyStitkyCreatorPrinted(params: {
  orderId: number;
  orderNumber: string;
  creatorUserId: number;
  actorUserId: number;
}): Promise<void> {
  if (params.creatorUserId === params.actorUserId) return;

  const actorName = await actorDisplayName(params.actorUserId);

  await prisma.notifications.create({
    data: {
      user_id: params.creatorUserId,
      title: "Štítky vytištěny",
      message: `${actorName} vytiskl/a zakázku ${params.orderNumber}.`,
      type: "stitky_printed",
      link: `/stitky/${params.orderId}`,
    },
  });
}

export async function notifyStitkyCreatorDone(params: {
  orderId: number;
  orderNumber: string;
  creatorUserId: number;
  actorUserId: number;
}): Promise<void> {
  if (params.creatorUserId === params.actorUserId) return;

  const actorName = await actorDisplayName(params.actorUserId);

  await prisma.notifications.create({
    data: {
      user_id: params.creatorUserId,
      title: "Štítky hotovo",
      message: `${actorName} označil/a zakázku ${params.orderNumber} jako zpracovanou.`,
      type: "stitky_done",
      link: `/stitky/${params.orderId}`,
    },
  });
}
