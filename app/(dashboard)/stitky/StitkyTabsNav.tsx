"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Inbox, List, Plus, Settings } from "lucide-react";

type Props = {
  canWrite: boolean;
  canQueue: boolean;
  canAll: boolean;
  canAdmin: boolean;
};

export function StitkyTabsNav({ canWrite, canQueue, canAll, canAdmin }: Props) {
  const pathname = usePathname();
  const isMine = pathname === "/stitky";
  const isQueue = pathname === "/stitky/fronta";
  const isAll = pathname === "/stitky/vse";
  const isSettings = pathname === "/stitky/settings";
  const isNew = pathname === "/stitky/new";

  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
      active
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
    }`;

  return (
    <nav className="mb-6 flex flex-wrap items-center gap-2 border-b border-gray-200 pb-4">
      <Link href="/stitky" className={tabClass(isMine)}>
        <List className="h-4 w-4" />
        Moje zakázky
      </Link>
      {canQueue && (
        <Link href="/stitky/fronta" className={tabClass(isQueue)}>
          <Inbox className="h-4 w-4" />
          Ke zpracování
        </Link>
      )}
      {canAll && (
        <Link href="/stitky/vse" className={tabClass(isAll)}>
          <ClipboardList className="h-4 w-4" />
          Všechny
        </Link>
      )}
      {canWrite && (
        <Link href="/stitky/new" className={tabClass(isNew)}>
          <Plus className="h-4 w-4" />
          Nová zakázka
        </Link>
      )}
      {canAdmin && (
        <Link href="/stitky/settings" className={tabClass(isSettings)}>
          <Settings className="h-4 w-4" />
          Nastavení
        </Link>
      )}
    </nav>
  );
}
