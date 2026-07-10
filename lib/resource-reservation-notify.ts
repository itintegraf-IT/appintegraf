import { prisma } from "@/lib/db";

type NotifyBase = {
  reservationId: number;
  resourceName: string;
  title: string;
};

function formatRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };
  return `${start.toLocaleString("cs-CZ", opts)} – ${end.toLocaleString("cs-CZ", opts)}`;
}

export async function notifyResourceReservationPending(args: {
  reservationId: number;
  approverUserId: number;
  resourceName: string;
  title: string;
  start: Date;
  end: Date;
}): Promise<void> {
  await prisma.notifications.create({
    data: {
      user_id: args.approverUserId,
      title: "Rezervace auta ke schválení",
      message: `${args.title} – ${args.resourceName}, ${formatRange(args.start, args.end)}`,
      type: "resource_reservation_pending",
      link: `/calendar/resources/vehicles/${args.reservationId}`,
    },
  });
}

export async function notifyResourceReservationApproved(
  args: NotifyBase & { requesterUserId: number }
): Promise<void> {
  await prisma.notifications.create({
    data: {
      user_id: args.requesterUserId,
      title: "Rezervace auta schválena",
      message: `${args.title} – ${args.resourceName}`,
      type: "resource_reservation_approved",
      link: `/calendar/resources/vehicles/${args.reservationId}`,
    },
  });
}

export async function notifyResourceReservationRejected(
  args: NotifyBase & { requesterUserId: number; comment: string }
): Promise<void> {
  await prisma.notifications.create({
    data: {
      user_id: args.requesterUserId,
      title: "Rezervace auta zamítnuta",
      message: `${args.title} – ${args.resourceName}. Důvod: ${args.comment}`,
      type: "resource_reservation_rejected",
      link: `/calendar/resources/vehicles/${args.reservationId}`,
    },
  });
}
