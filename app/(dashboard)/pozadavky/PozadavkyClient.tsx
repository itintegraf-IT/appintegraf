"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ClipboardList, Headphones } from "lucide-react";
import { TechnikaTab } from "./_components/TechnikaTab";
import { HelpdeskTab } from "./_components/HelpdeskTab";

type UserProfile = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  department_name: string | null;
  position: string | null;
};

function tabHref(tab: string, extra?: Record<string, string>) {
  const q = new URLSearchParams({ tab });
  if (extra) {
    for (const [k, v] of Object.entries(extra)) q.set(k, v);
  }
  return `/pozadavky?${q.toString()}`;
}

export function PozadavkyClient({ profile }: { profile: UserProfile }) {
  const searchParams = useSearchParams();
  const tab = searchParams?.get("tab") === "helpdesk" ? "helpdesk" : "technika";

  return (
    <>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <ClipboardList className="h-7 w-7 text-red-600" />
          IT požadavky
        </h1>
        <p className="mt-1 text-gray-600">
          Požadavky na techniku a helpdesk IT servis
        </p>
      </div>

      <div className="mb-6 flex gap-2 border-b border-gray-200">
        <Link
          href={tabHref("technika")}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium ${
            tab === "technika"
              ? "border-red-600 text-red-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          Technika
        </Link>
        <Link
          href={tabHref("helpdesk")}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium ${
            tab === "helpdesk"
              ? "border-red-600 text-red-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          <Headphones className="h-4 w-4" />
          Helpdesk
        </Link>
      </div>

      {tab === "technika" ? <TechnikaTab profile={profile} /> : <HelpdeskTab />}
    </>
  );
}
