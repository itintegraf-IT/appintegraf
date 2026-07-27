import { prisma } from "@/lib/db";
import { sendMaketaEmail } from "@/lib/email";
import { collectMaketaNotifyUserIds } from "@/lib/makety-recipients";
import {
  filterUserIdsAllowingEmail,
  userAllowsEmailNotification,
} from "@/lib/user-email-notifications-db";

export type MaketaNotifyKind =
  | "assigned"
  | "deadline_changed"
  | "done"
  | "comment"
  | "quote_submitted"
  | "quote_approved"
  | "quote_rejected";

type UserEmailRow = {
  email: string | null;
  first_name: string;
  last_name: string;
};

async function sendMaketaEmailsToUsers(
  users: UserEmailRow[],
  params: {
    subject: string;
    intro: string;
    bodyPreview: string;
    orderNumber: string | null;
    maketaId: number;
  }
): Promise<void> {
  for (const u of users) {
    if (!u.email) continue;
    await sendMaketaEmail({
      toEmail: u.email,
      toName: `${u.first_name} ${u.last_name}`.trim() || "Uživateli",
      subject: params.subject,
      intro: params.intro,
      bodyPreview: params.bodyPreview,
      orderNumber: params.orderNumber,
      maketaId: params.maketaId,
    });
  }
}

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
  const title = titleByKind[params.kind];
  const intro = messageByKind[params.kind];

  for (const uid of ids) {
    await prisma.notifications.create({
      data: {
        user_id: uid,
        title,
        message: `${intro} ${params.bodyPreview.slice(0, 200)}`,
        type,
        link: linkPath,
      },
    });
  }

  const emailIds = await filterUserIdsAllowingEmail(ids, "makety");
  if (emailIds.length > 0) {
    const users = await prisma.users.findMany({
      where: { id: { in: emailIds } },
      select: { email: true, first_name: true, last_name: true },
    });

    await sendMaketaEmailsToUsers(users, {
      subject: `${title} – INTEGRAF`,
      intro,
      bodyPreview: params.bodyPreview,
      orderNumber: params.orderNumber,
      maketaId: params.maketaId,
    });
  }
}

export async function notifyMaketaCreator(params: {
  maketaId: number;
  creatorUserId: number;
  title: string;
  message: string;
  type: string;
  orderNumber?: string | null;
  bodyPreview?: string;
}): Promise<void> {
  await notifyMaketaUser(params.creatorUserId, {
    maketaId: params.maketaId,
    title: params.title,
    message: params.message,
    type: params.type,
  });

  if (!(await userAllowsEmailNotification(params.creatorUserId, "makety"))) return;
  if (params.bodyPreview === undefined) return;

  const creator = await prisma.users.findUnique({
    where: { id: params.creatorUserId },
    select: { email: true, first_name: true, last_name: true },
  });
  if (!creator?.email) return;

  await sendMaketaEmail({
    toEmail: creator.email,
    toName: `${creator.first_name} ${creator.last_name}`.trim() || "Uživateli",
    subject: `${params.title} – INTEGRAF`,
    intro: params.message,
    bodyPreview: params.bodyPreview,
    orderNumber: params.orderNumber ?? null,
    maketaId: params.maketaId,
  });
}

export async function notifyMaketaQuoteSubmitted(params: {
  maketaId: number;
  creatorUserId: number;
  orderNumber: string | null;
  bodyPreview: string;
}): Promise<void> {
  const intro = `Výrobce odeslal cenu a popis výroby${params.orderNumber ? ` (zakázka ${params.orderNumber})` : ""}.`;
  await notifyMaketaCreator({
    maketaId: params.maketaId,
    creatorUserId: params.creatorUserId,
    title: "Nabídka k maketě",
    message: `${intro} ${params.bodyPreview.slice(0, 150)}`,
    type: "makety_quote_submitted",
    orderNumber: params.orderNumber,
    bodyPreview: params.bodyPreview,
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
  const intro = `${doneByName} označil/a maketu jako hotovou${params.orderNumber ? ` (zakázka ${params.orderNumber})` : ""}.`;

  await prisma.notifications.create({
    data: {
      user_id: params.creatorUserId,
      title: "Maketa dokončena",
      message: intro,
      type: "makety_done",
      link: `/makety/${params.maketaId}`,
    },
  });

  if (!(await userAllowsEmailNotification(params.creatorUserId, "makety"))) return;

  const creator = await prisma.users.findUnique({
    where: { id: params.creatorUserId },
    select: { email: true, first_name: true, last_name: true },
  });
  if (!creator?.email) return;

  await sendMaketaEmail({
    toEmail: creator.email,
    toName: `${creator.first_name} ${creator.last_name}`.trim() || "Uživateli",
    subject: "Maketa dokončena – INTEGRAF",
    intro,
    bodyPreview: params.bodyPreview,
    orderNumber: params.orderNumber,
    maketaId: params.maketaId,
  });
}
