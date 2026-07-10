import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { findResourceReservationOverlap } from "@/lib/resource-reservation-overlap";
import { resolveVehicleReservationApprover } from "@/lib/resource-vehicle-approver-resolution";
import type { ResourceType } from "@/lib/resource-reservation-types";
import {
  notifyResourceReservationApproved,
  notifyResourceReservationPending,
  notifyResourceReservationRejected,
} from "@/lib/resource-reservation-notify";

type Db = Prisma.TransactionClient;

export type CreateReservationInput = {
  resourceId: number;
  userId: number;
  title: string;
  description?: string;
  purpose?: string;
  start: Date;
  end: Date;
};

export async function createResourceReservation(
  db: Db,
  input: CreateReservationInput
): Promise<{ id: number; approval_status: string }> {
  if (input.end <= input.start) {
    throw new Error("Konec rezervace musí být po začátku.");
  }

  const resource = await db.calendar_resources.findFirst({
    where: { id: input.resourceId, is_active: true },
    select: { id: true, name: true, resource_type: true },
  });
  if (!resource) {
    throw new Error("Zdroj nenalezen nebo není aktivní.");
  }

  const overlap = await findResourceReservationOverlap(
    db,
    input.resourceId,
    input.start,
    input.end
  );
  if (overlap) {
    throw new Error(`RESOURCE_OVERLAP:${resource.name}`);
  }

  const resourceType = resource.resource_type as ResourceType;

  if (resourceType === "room") {
    const reservation = await db.resource_reservations.create({
      data: {
        resource_id: input.resourceId,
        created_by: input.userId,
        title: input.title,
        description: input.description || null,
        purpose: input.purpose || null,
        start_date: input.start,
        end_date: input.end,
        approval_status: "approved",
        approved_at: new Date(),
      },
      select: { id: true, approval_status: true },
    });
    return reservation;
  }

  const approver = await resolveVehicleReservationApprover(db, input.start, input.end);
  if (!approver) {
    throw new Error("Není nastaven žádný dostupný správce vozidel pro schválení.");
  }

  const reservation = await db.resource_reservations.create({
    data: {
      resource_id: input.resourceId,
      created_by: input.userId,
      title: input.title,
      description: input.description || null,
      purpose: input.purpose || null,
      start_date: input.start,
      end_date: input.end,
      approval_status: "pending",
      assigned_approver_id: approver.userId,
    },
    select: { id: true, approval_status: true },
  });

  await notifyResourceReservationPending({
    reservationId: reservation.id,
    approverUserId: approver.userId,
    resourceName: resource.name,
    title: input.title,
    start: input.start,
    end: input.end,
  });

  return reservation;
}

export async function approveResourceReservation(
  db: Db,
  reservationId: number,
  approverUserId: number
): Promise<void> {
  const reservation = await db.resource_reservations.findUnique({
    where: { id: reservationId },
    include: {
      calendar_resources: { select: { name: true, resource_type: true } },
      users_created: { select: { id: true, first_name: true, last_name: true } },
    },
  });
  if (!reservation || reservation.approval_status !== "pending") {
    throw new Error("Rezervace není ke schválení.");
  }

  await db.resource_reservations.update({
    where: { id: reservationId },
    data: {
      approval_status: "approved",
      approver_id: approverUserId,
      assigned_approver_id: null,
      approved_at: new Date(),
    },
  });

  await notifyResourceReservationApproved({
    reservationId,
    requesterUserId: reservation.created_by,
    resourceName: reservation.calendar_resources.name,
    title: reservation.title,
  });
}

export async function rejectResourceReservation(
  db: Db,
  reservationId: number,
  approverUserId: number,
  comment: string
): Promise<void> {
  const reservation = await db.resource_reservations.findUnique({
    where: { id: reservationId },
    include: { calendar_resources: { select: { name: true } } },
  });
  if (!reservation || reservation.approval_status !== "pending") {
    throw new Error("Rezervace není ke schválení.");
  }

  await db.resource_reservations.update({
    where: { id: reservationId },
    data: {
      approval_status: "rejected",
      approver_id: approverUserId,
      assigned_approver_id: null,
      rejection_comment: comment,
    },
  });

  await notifyResourceReservationRejected({
    reservationId,
    requesterUserId: reservation.created_by,
    resourceName: reservation.calendar_resources.name,
    title: reservation.title,
    comment,
  });
}

export async function updateResourceReservation(
  db: Db,
  reservationId: number,
  input: Partial<CreateReservationInput>
): Promise<void> {
  const existing = await db.resource_reservations.findUnique({
    where: { id: reservationId },
    include: { calendar_resources: { select: { name: true, resource_type: true } } },
  });
  if (!existing) throw new Error("Rezervace nenalezena.");

  const start = input.start ?? existing.start_date;
  const end = input.end ?? existing.end_date;
  const resourceId = input.resourceId ?? existing.resource_id;

  if (end <= start) throw new Error("Konec rezervace musí být po začátku.");

  const overlap = await findResourceReservationOverlap(db, resourceId, start, end, {
    excludeReservationId: reservationId,
  });
  if (overlap) {
    throw new Error(`RESOURCE_OVERLAP:${existing.calendar_resources.name}`);
  }

  const isVehicle = existing.calendar_resources.resource_type === "vehicle";
  let assignedApproverId = existing.assigned_approver_id;
  let approvalStatus = existing.approval_status;

  if (isVehicle && (input.start || input.end || input.resourceId)) {
    const approver = await resolveVehicleReservationApprover(db, start, end);
    if (!approver) throw new Error("Není nastaven žádný dostupný správce vozidel.");
    assignedApproverId = approver.userId;
    approvalStatus = "pending";
  }

  await db.resource_reservations.update({
    where: { id: reservationId },
    data: {
      resource_id: resourceId,
      title: input.title ?? existing.title,
      description: input.description ?? existing.description,
      purpose: input.purpose ?? existing.purpose,
      start_date: start,
      end_date: end,
      approval_status: approvalStatus,
      assigned_approver_id: assignedApproverId,
      approver_id: isVehicle && approvalStatus === "pending" ? null : existing.approver_id,
      approved_at: isVehicle && approvalStatus === "pending" ? null : existing.approved_at,
      rejection_comment:
        isVehicle && approvalStatus === "pending" ? null : existing.rejection_comment,
    },
  });
}

export async function runInReservationTransaction<T>(
  fn: (db: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(fn);
}
