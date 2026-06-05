"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, Calendar, LayoutList, List, Plus, Users } from "lucide-react";

export function MaketyTabsNav({
  canWrite,
  canModuleAdmin,
  canVyroba,
  canGrafika,
  canManageQueue,
}: {
  canWrite: boolean;
  canModuleAdmin: boolean;
  canVyroba: boolean;
  canGrafika: boolean;
  canManageQueue: boolean;
}) {
  const pathname = usePathname();
  const isList = pathname === "/makety";
  const isZadani = pathname === "/makety/zadani";
  const isNew = pathname === "/makety/new";
  const isNewGrafika = pathname === "/makety/grafika/new";
  const isArchive = pathname === "/makety/archive";
  const isKalendar = pathname === "/makety/kalendar";
  const isKalendarGrafika = pathname === "/makety/kalendar-grafika";
  const isFronta = pathname === "/makety/fronta";

  const showZadani = canWrite || canModuleAdmin;
  const showKalendarMaket = canModuleAdmin || canVyroba || canWrite;
  const showKalendarGrafika = canModuleAdmin || canGrafika || canWrite;

  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
      active
        ? "border-violet-200 bg-violet-50 text-violet-700"
        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
    }`;

  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 pb-4">
      <Link href="/makety" className={tabClass(isList)}>
        <List className="h-4 w-4" />
        {canModuleAdmin ? "Přehled zakázek" : "Moje makety"}
      </Link>
      {canManageQueue && (
        <Link href="/makety/fronta" className={tabClass(isFronta)}>
          <LayoutList className="h-4 w-4" />
          Fronta výroby
        </Link>
      )}
      {showZadani && (
        <Link href="/makety/zadani" className={tabClass(isZadani)}>
          <Users className="h-4 w-4" />
          Sledování zadání
        </Link>
      )}
      {canWrite && (
        <Link href="/makety/new" className={tabClass(isNew)}>
          <Plus className="h-4 w-4" />
          Nová maketa
        </Link>
      )}
      {canWrite && (
        <Link href="/makety/grafika/new" className={tabClass(isNewGrafika)}>
          <Plus className="h-4 w-4" />
          Nová grafika
        </Link>
      )}
      {showKalendarMaket && (
        <Link href="/makety/kalendar" className={tabClass(isKalendar)}>
          <Calendar className="h-4 w-4" />
          Kalendář maket
        </Link>
      )}
      {showKalendarGrafika && (
        <Link href="/makety/kalendar-grafika" className={tabClass(isKalendarGrafika)}>
          <Calendar className="h-4 w-4" />
          Kalendář grafiky
        </Link>
      )}
      <Link href="/makety/archive" className={tabClass(isArchive)}>
        <Archive className="h-4 w-4" />
        Archiv
      </Link>
    </nav>
  );
}
