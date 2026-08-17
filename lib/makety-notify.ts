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
  | "workflow_assigned"
  | "deadline_changed"
  | "done"
  | "awaiting_prepress"
  | "awaiting_final"
  | "prepress_ok"
  | "sent_for_client"
  | "client_approved"
  | "client_rejected"
  | "approved"
  | "data_problem"
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
    case "workflow_assigned":
      return {
        title: `Jste ve workflow ${w.genitive}`,
        intro:
          workType === "grafika"
            ? `Byli jste zařazeni do schvalovacího workflow grafiky${zak}. Až na vás přijde řada, dostanete samostatnou výzvu ke schválení.`
            : `Byli jste zařazeni do workflow ${w.genitive}${zak}.`,
      };
    case "deadline_changed":
      return {
        title: `Změna termínu ${w.genitive}`,
        intro: `U ${w.genitive}${zak} byl změněn termín.`,
      };
    case "done":
      if (workType === "grafika") {
        return {
          title: "Grafika hotová – čeká na prepress",
          intro: `Grafik dokončil práci na grafice${zak}. Zakázka čeká na schválení prepressem.`,
        };
      }
      return {
        title: `${w.label} dokončena`,
        intro: `${w.label}${zak} byla označena jako hotová.`,
      };
    case "awaiting_prepress":
      return {
        title: "Grafika ke schválení (prepress)",
        intro: `Máte grafiku ke schválení prepressem${zak}. Zkontrolujte data a schvalte, nebo vraťte k úpravě.`,
      };
    case "awaiting_final":
      return {
        title: "Grafika ke finálnímu schválení",
        intro: `Máte grafiku ke finálnímu schválení${zak}. Prepress již schválil – můžete odeslat ke schválení klientovi a dokončit.`,
      };
    case "prepress_ok":
      return {
        title: "Grafika schválena prepressem",
        intro: `Prepress schválil grafiku${zak}. Čeká na finálního schvalovatele.`,
      };
    case "sent_for_client":
      return {
        title: "Grafika odeslána ke schválení",
        intro: `Grafika${zak} byla odeslána ke schválení (klient / další krok).`,
      };
    case "client_approved":
      return {
        title: "Klient schválil softproof",
        intro: `Klient schválil softproof grafiky${zak}. Stav zakázky se nemění – dokončete finální schválení v aplikaci.`,
      };
    case "client_rejected":
      return {
        title: "Klient zamítl softproof",
        intro: `Klient zamítl softproof grafiky${zak}. Důvod je v komentáři u zakázky.`,
      };
    case "approved":
      return {
        title: "Grafika finálně schválena",
        intro: `Grafika${zak} byla finálně schválena.`,
      };
    case "data_problem":
      return {
        title: "Grafika pozastavena – problém s daty",
        intro: `Grafik pozastavil grafiku${zak} kvůli problému s daty. Doplňte podklady a uvolněte zakázku ke zpracování.`,
      };
    case "comment":
      return {
        title: `Nový komentář ${w.toPrep}`,
        intro: `U ${w.genitive}${zak} vám byl adresován komentář.`,
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

/** Odešle notifikaci (+ e-mail) konkrétním uživatelům se zvoleným textem. */
export async function notifyMaketaUsers(params: {
  maketaId: number;
  userIds: Array<number | null | undefined>;
  bodyPreview: string;
  orderNumber: string | null;
  kind: MaketaNotifyKind;
  workType?: MaketyWorkType | string | null;
  excludeUserId?: number;
}): Promise<void> {
  const set = new Set<number>();
  for (const id of params.userIds) {
    if (id != null && id !== params.excludeUserId) set.add(id);
  }
  const allIds = [...set];
  if (allIds.length === 0) return;

  const workType = normalizeMaketyWorkType(params.workType);
  const linkPath = `/makety/${params.maketaId}`;
  const { title, intro } = notifyCopy(workType, params.kind, params.orderNumber);
  const type = `makety_${params.kind}`;

  for (const uid of allIds) {
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

  const emailIds = await filterUserIdsAllowingEmail(allIds, "makety");
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

export async function notifyMaketaRecipients(params: {
  maketaId: number;
  bodyPreview: string;
  orderNumber: string | null;
  kind: MaketaNotifyKind;
  assigneeUserId: number | null;
  workType?: MaketyWorkType | string | null;
  excludeUserId?: number;
  /** Další příjemci (prepress, finální schvalovatel). */
  extraUserIds?: Array<number | null | undefined>;
}): Promise<void> {
  const ids = await collectMaketaNotifyUserIds(params.assigneeUserId, params.excludeUserId);
  await notifyMaketaUsers({
    maketaId: params.maketaId,
    userIds: [...ids, ...(params.extraUserIds ?? [])],
    bodyPreview: params.bodyPreview,
    orderNumber: params.orderNumber,
    kind: params.kind,
    workType: params.workType,
    excludeUserId: params.excludeUserId,
  });
}

/**
 * Při založení grafiky: grafik dostane „přidělena“,
 * schvalovatelé jen info o zařazení do workflow (ne „přidělena“).
 */
export async function notifyGrafikaWorkflowCreated(params: {
  maketaId: number;
  bodyPreview: string;
  orderNumber: string | null;
  assigneeUserId: number;
  prepressUserId: number | null;
  finalApproverUserId: number | null;
  excludeUserId?: number;
}): Promise<void> {
  await notifyMaketaUsers({
    maketaId: params.maketaId,
    userIds: [params.assigneeUserId],
    bodyPreview: params.bodyPreview,
    orderNumber: params.orderNumber,
    kind: "assigned",
    workType: "grafika",
    excludeUserId: params.excludeUserId,
  });

  const approvers = [params.prepressUserId, params.finalApproverUserId].filter(
    (id): id is number => id != null && id !== params.assigneeUserId
  );
  if (approvers.length > 0) {
    await notifyMaketaUsers({
      maketaId: params.maketaId,
      userIds: approvers,
      bodyPreview: params.bodyPreview,
      orderNumber: params.orderNumber,
      kind: "workflow_assigned",
      workType: "grafika",
      excludeUserId: params.excludeUserId,
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
  /** U grafiky – notifikovat prepress ke schválení. */
  prepressUserId?: number | null;
}): Promise<void> {
  const workType = normalizeMaketyWorkType(params.workType);
  const w = maketyWorkTypeWording(workType);

  const doneBy = await prisma.users.findUnique({
    where: { id: params.doneByUserId },
    select: { first_name: true, last_name: true },
  });
  const doneByName = doneBy ? `${doneBy.first_name} ${doneBy.last_name}`.trim() : "Uživatel";

  if (workType === "grafika") {
    if (params.prepressUserId != null && params.prepressUserId !== params.doneByUserId) {
      await notifyMaketaUsers({
        maketaId: params.maketaId,
        userIds: [params.prepressUserId],
        bodyPreview: params.bodyPreview,
        orderNumber: params.orderNumber,
        kind: "awaiting_prepress",
        workType: "grafika",
        excludeUserId: params.doneByUserId,
      });
    }
    if (params.creatorUserId !== params.doneByUserId) {
      const intro = `${doneByName} dokončil/a grafiku${orderSuffix(params.orderNumber)} – čeká na schválení prepressem.`;
      await notifyMaketaCreator({
        maketaId: params.maketaId,
        creatorUserId: params.creatorUserId,
        title: "Grafika hotová – čeká na prepress",
        message: intro,
        type: "makety_done",
        orderNumber: params.orderNumber,
        bodyPreview: params.bodyPreview,
        workType,
      });
    }
    return;
  }

  if (params.creatorUserId === params.doneByUserId) return;

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
