import { prisma } from "@/lib/db";
import { sendMaketaEmail } from "@/lib/email";
import { collectMaketaNotifyUserIds } from "@/lib/makety-recipients";
import {
  maketyWorkTypeWording,
  normalizeMaketyWorkType,
  type MaketyWorkType,
} from "@/lib/makety-work-type";
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

function orderSuffix(orderNumber: string | null): string {
  return orderNumber ? ` (zakázka ${orderNumber})` : "";
}

function notifyCopy(
  workType: MaketyWorkType,
  kind: MaketaNotifyKind,
  orderNumber: string | null
): { title: string; intro: string } {
  const w = maketyWorkTypeWording(workType);
  const zak = orderSuffix(orderNumber);

  switch (kind) {
    case "assigned":
      return {
        title: `Nová ${w.nominative}`,
        intro: `Byla vám přidělena ${w.nominative}${zak}.`,
      };
    case "deadline_changed":
      return {
        title: `Změna termínu ${w.genitive}`,
        intro: `U ${w.genitive}${zak} byl změněn termín.`,
      };
    case "done":
      return {
        title: `${w.label} dokončena`,
        intro: `${w.label}${zak} byla označena jako hotová.`,
      };
    case "comment":
      return {
        title: `Nový komentář ${w.toPrep}`,
        intro: `U ${w.genitive}${zak} byl přidán komentář.`,
      };
    case "quote_submitted":
      return {
        title: `Nabídka ${w.toPrep}`,
        intro: `Výrobce odeslal nabídku ${w.toPrep}${zak}.`,
      };
    case "quote_approved":
      return {
        title: `${w.label} schválena`,
        intro: `Zadavatel schválil ${w.accusative} do výroby${zak}.`,
      };
    case "quote_rejected":
      return {
        title: "Nabídka zamítnuta",
        intro: `Zadavatel zamítl nabídku ${w.toPrep}${zak}.`,
      };
  }
}

async function sendMaketaEmailsToUsers(
  users: UserEmailRow[],
  params: {
    subject: string;
    intro: string;
    bodyPreview: string;
    orderNumber: string | null;
    maketaId: number;
    workType: MaketyWorkType;
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
      workType: params.workType,
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
  workType?: MaketyWorkType | string | null;
  excludeUserId?: number;
}): Promise<void> {
  const ids = await collectMaketaNotifyUserIds(params.assigneeUserId, params.excludeUserId);
  if (ids.length === 0) return;

  const workType = normalizeMaketyWorkType(params.workType);
  const linkPath = `/makety/${params.maketaId}`;
  const { title, intro } = notifyCopy(workType, params.kind, params.orderNumber);
  const type = `makety_${params.kind}`;

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
      workType,
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
  workType?: MaketyWorkType | string | null;
}): Promise<void> {
  const workType = normalizeMaketyWorkType(params.workType);

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
    workType,
  });
}

export async function notifyMaketaQuoteSubmitted(params: {
  maketaId: number;
  creatorUserId: number;
  orderNumber: string | null;
  bodyPreview: string;
  workType?: MaketyWorkType | string | null;
}): Promise<void> {
  const workType = normalizeMaketyWorkType(params.workType ?? "maketa");
  const w = maketyWorkTypeWording(workType);
  const intro = `Výrobce odeslal cenu a popis výroby${orderSuffix(params.orderNumber)}.`;
  await notifyMaketaCreator({
    maketaId: params.maketaId,
    creatorUserId: params.creatorUserId,
    title: `Nabídka ${w.toPrep}`,
    message: `${intro} ${params.bodyPreview.slice(0, 150)}`,
    type: "makety_quote_submitted",
    orderNumber: params.orderNumber,
    bodyPreview: params.bodyPreview,
    workType,
  });
}

export async function notifyMaketaDone(params: {
  maketaId: number;
  doneByUserId: number;
  creatorUserId: number;
  bodyPreview: string;
  orderNumber: string | null;
  workType?: MaketyWorkType | string | null;
}): Promise<void> {
  if (params.creatorUserId === params.doneByUserId) return;

  const workType = normalizeMaketyWorkType(params.workType);
  const w = maketyWorkTypeWording(workType);

  const doneBy = await prisma.users.findUnique({
    where: { id: params.doneByUserId },
    select: { first_name: true, last_name: true },
  });
  const doneByName = doneBy ? `${doneBy.first_name} ${doneBy.last_name}`.trim() : "Uživatel";
  const intro = `${doneByName} označil/a ${w.accusative} jako hotovou${orderSuffix(params.orderNumber)}.`;
  const title = `${w.label} dokončena`;

  await prisma.notifications.create({
    data: {
      user_id: params.creatorUserId,
      title,
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
    subject: `${title} – INTEGRAF`,
    intro,
    bodyPreview: params.bodyPreview,
    orderNumber: params.orderNumber,
    maketaId: params.maketaId,
    workType,
  });
}
