"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Car, Calendar } from "lucide-react";

export function ResourceCalendarTabs() {
  const pathname = usePathname();
  const isRooms = pathname.includes("/rooms");
  const isVehicles = pathname.includes("/vehicles");

  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
      active ? "bg-red-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"
    }`;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
        <Link href="/calendar/resources/rooms" className={tabClass(isRooms)}>
          <Building2 className="h-4 w-4" />
          Místnosti
        </Link>
        <Link href="/calendar/resources/vehicles" className={tabClass(isVehicles)}>
          <Car className="h-4 w-4" />
          Auta
        </Link>
      </div>
      <Link
        href="/calendar"
        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
      >
        <Calendar className="h-4 w-4" />
        Kalendář absence
      </Link>
    </div>
  );
}
