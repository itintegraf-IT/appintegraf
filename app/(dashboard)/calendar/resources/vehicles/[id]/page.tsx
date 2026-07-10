import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  canApproveVehicleReservation,
  canViewReservation,
} from "@/lib/resource-reservation-access";
import { reservationStatusLabel } from "@/lib/resource-reservation-types";
import { ArrowLeft, Car } from "lucide-react";
import { ResourceApproveRejectButtons } from "../../_components/ResourceApproveRejectButtons";
import { DeleteResourceReservationButton } from "../../_components/DeleteResourceReservationButton";

export default async function VehicleReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  const id = parseInt((await params).id, 10);
  if (isNaN(id)) notFound();

  const reservation = await prisma.resource_reservations.findUnique({
    where: { id },
    include: {
      calendar_resources: true,
      users_created: { select: { id: true, first_name: true, last_name: true, email: true } },
      users_approver: { select: { first_name: true, last_name: true } },
      users_assigned: { select: { first_name: true, last_name: true } },
    },
  });

  if (!reservation || reservation.calendar_resources.resource_type !== "vehicle") {
    notFound();
  }

  if (
    !(await canViewReservation(userId, {
      created_by: reservation.created_by,
      assigned_approver_id: reservation.assigned_approver_id,
    }))
  ) {
    redirect("/calendar/resources/vehicles");
  }

  const canApprove = await canApproveVehicleReservation(userId, {
    approval_status: reservation.approval_status,
    assigned_approver_id: reservation.assigned_approver_id,
  });

  const fmt = (d: Date) =>
    d.toLocaleString("cs-CZ", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <>
      <Link
        href="/calendar/resources/vehicles"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-red-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Zpět na auta
      </Link>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Car className="h-7 w-7 text-red-600" />
          {reservation.title}
        </h1>
        <p className="mt-1 text-gray-600">{reservation.calendar_resources.name}</p>

        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">Termín</dt>
            <dd className="font-medium text-gray-900">
              {fmt(reservation.start_date)} – {fmt(reservation.end_date)}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Stav</dt>
            <dd className="font-medium text-gray-900">
              {reservationStatusLabel(
                reservation.approval_status as "approved" | "pending" | "rejected"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Žadatel</dt>
            <dd className="font-medium text-gray-900">
              {reservation.users_created.first_name} {reservation.users_created.last_name}
            </dd>
          </div>
          {reservation.users_assigned && reservation.approval_status === "pending" && (
            <div>
              <dt className="text-gray-500">Ke schválení u</dt>
              <dd className="font-medium text-gray-900">
                {reservation.users_assigned.first_name} {reservation.users_assigned.last_name}
              </dd>
            </div>
          )}
          {reservation.purpose && (
            <div className="sm:col-span-2">
              <dt className="text-gray-500">Účel</dt>
              <dd className="text-gray-900">{reservation.purpose}</dd>
            </div>
          )}
          {reservation.description && (
            <div className="sm:col-span-2">
              <dt className="text-gray-500">Poznámka</dt>
              <dd className="text-gray-900">{reservation.description}</dd>
            </div>
          )}
          {reservation.rejection_comment && (
            <div className="sm:col-span-2">
              <dt className="text-gray-500">Důvod zamítnutí</dt>
              <dd className="text-red-700">{reservation.rejection_comment}</dd>
            </div>
          )}
        </dl>

        <div className="mt-6 flex flex-wrap gap-3">
          {canApprove && (
            <ResourceApproveRejectButtons
              reservationId={reservation.id}
              title={reservation.title}
            />
          )}
          <DeleteResourceReservationButton
            reservationId={reservation.id}
            canDelete={
              reservation.created_by === userId || canApprove
            }
          />
        </div>
      </div>
    </>
  );
}
