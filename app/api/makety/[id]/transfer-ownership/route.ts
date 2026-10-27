import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAccessMaketyModule } from "@/lib/makety-module-access";
import {
  canZadatMaketyWork,
  userCanForceClaimMaketaOwnership,
  userCanTransferMaketaOwnership,
} from "@/lib/makety-access";
import { maketyWorkTypeLabel, type MaketyWorkType } from "@/lib/makety-work-type";

/**
 * POST /api/makety/[id]/transfer-ownership
 * Body: { newOwnerUserId: number } | { forceClaim: true }
 * Změní created_by na jiného uživatele / na sebe (nucené přebrání adminem).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAccessMaketyModule(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    newOwnerUserId?: unknown;
    forceClaim?: unknown;
  };
  const forceClaim = body.forceClaim === true;

  if (forceClaim) {
    if (!(await userCanForceClaimMaketaOwnership(userId, id))) {
      return NextResponse.json(
        { error: "Nucené přebrání smí jen admin modulu Makety (a nesmíte být už zadavatelem)" },
        { status: 403 }
      );
    }
  } else if (!(await userCanTransferMaketaOwnership(userId, id))) {
    return NextResponse.json(
      { error: "Řízení může předat jen zadavatel nebo admin modulu" },
      { status: 403 }
    );
  }

  const newOwnerUserId = forceClaim
    ? userId
    : typeof body.newOwnerUserId === "number"
      ? body.newOwnerUserId
      : parseInt(String(body.newOwnerUserId ?? ""), 10);
  if (!Number.isFinite(newOwnerUserId) || newOwnerUserId <= 0) {
    return NextResponse.json({ error: "Neplatný cílový uživatel" }, { status: 400 });
  }

  const maketa = await prisma.makety.findUnique({
    where: { id },
    select: {
      id: true,
      created_by: true,
      work_type: true,
      order_number: true,
      users_creator: { select: { first_name: true, last_name: true } },
    },
  });
  if (!maketa) {
    return NextResponse.json({ error: "Zakázka nenalezena" }, { status: 404 });
  }

  if (maketa.created_by === newOwnerUserId) {
    return NextResponse.json(
      { error: "Tento uživatel už je zadavatelem zakázky" },
      { status: 400 }
    );
  }

  const workType = (maketa.work_type === "grafika" ? "grafika" : "maketa") as MaketyWorkType;

  const newOwner = await prisma.users.findFirst({
    where: {
      id: newOwnerUserId,
      OR: [{ is_active: true }, { is_active: null }],
    },
    select: { id: true, first_name: true, last_name: true },
  });
  if (!newOwner) {
    return NextResponse.json(
      { error: "Cílový uživatel neexistuje nebo není aktivní" },
      { status: 400 }
    );
  }
  if (!(await canZadatMaketyWork(newOwner.id, workType))) {
    return NextResponse.json(
      {
        error: `Cílový uživatel nemá oprávnění zadávat typ „${maketyWorkTypeLabel(workType)}“`,
      },
      { status: 400 }
    );
  }

  const actor = await prisma.users.findUnique({
    where: { id: userId },
    select: { first_name: true, last_name: true },
  });
  const actorName = actor
    ? `${actor.first_name} ${actor.last_name}`
    : `uživatel #${userId}`;
  const fromName = `${maketa.users_creator.first_name} ${maketa.users_creator.last_name}`;
  const toName = `${newOwner.first_name} ${newOwner.last_name}`;

  try {
    await prisma.makety.update({
      where: { id },
      data: { created_by: newOwner.id },
    });

    await prisma.makety_comments.create({
      data: {
        maketa_id: id,
        user_id: userId,
        body: forceClaim
          ? `Nucené přebrání řízení: ${fromName} → ${toName} (admin ${actorName}).`
          : `Předání řízení: ${fromName} → ${toName} (provedl/a ${actorName}).`,
      },
    });

    const orderLabel = maketa.order_number?.trim() || `#${id}`;
    await prisma.notifications.create({
      data: {
        user_id: newOwner.id,
        title: forceClaim ? "Nucené přebrání řízení zakázky" : "Předáno řízení zakázky",
        message: forceClaim
          ? `Převzali jste řízení ${maketyWorkTypeLabel(workType).toLowerCase()} ${orderLabel}. Nyní jste zadavatelem.`
          : `Bylo vám předáno řízení ${maketyWorkTypeLabel(workType).toLowerCase()} ${orderLabel}. Nyní jste zadavatelem.`,
        type: forceClaim ? "makety_ownership_force_claim" : "makety_ownership_transfer",
        link: `/makety/${id}`,
      },
    });

    return NextResponse.json({
      success: true,
      forceClaim,
      created_by: newOwner.id,
      newOwner: {
        id: newOwner.id,
        first_name: newOwner.first_name,
        last_name: newOwner.last_name,
      },
    });
  } catch (e) {
    console.error("transfer-ownership", e);
    return NextResponse.json(
      { error: forceClaim ? "Nucené přebrání se nezdařilo" : "Předání řízení se nezdařilo" },
      { status: 500 }
    );
  }
}
