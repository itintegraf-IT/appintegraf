import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { redirectAdminDenied } from "@/lib/navigation-errors";
import { isAdmin } from "@/lib/auth-utils";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ArrowLeft, Car } from "lucide-react";
import { VehicleApproversClient } from "./VehicleApproversClient";

export default async function AdminVehicleApproversPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    redirectAdminDenied();
  }

  const config = await prisma.resource_vehicle_approvers.findUnique({
    where: { id: 1 },
    include: {
      users_primary: { select: { id: true, first_name: true, last_name: true } },
      users_secondary: { select: { id: true, first_name: true, last_name: true } },
      users_tertiary: { select: { id: true, first_name: true, last_name: true } },
    },
  });

  return (
    <>
      <div className="mb-6">
        <Link
          href="/admin"
          className="mb-2 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-red-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Administrace
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Car className="h-7 w-7 text-red-600" />
          Správci vozidel
        </h1>
        <p className="mt-1 text-gray-600">Schvalování rezervací aut v kalendáři</p>
      </div>
      <VehicleApproversClient config={config} />
    </>
  );
}
