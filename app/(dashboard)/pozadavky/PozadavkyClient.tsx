"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ClipboardList, Headphones, BookOpen, Building2, Network } from "lucide-react";
import { TechnikaTab } from "./_components/TechnikaTab";
import { HelpdeskTab } from "./_components/HelpdeskTab";
import { ReseniProblemuTab } from "./_components/ReseniProblemuTab";
import { ExterniDodavateleTab } from "./_components/ExterniDodavateleTab";
import { SitIpTab } from "./_components/SitIpTab";
import type { TroubleCategory } from "@/lib/helpdesk/parse-trouble-kb";

type UserProfile = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  department_name: string | null;
  position: string | null;
};

type TabId = "technika" | "helpdesk" | "reseni" | "externi" | "sit";

function tabHref(tab: string, extra?: Record<string, string>) {
  const q = new URLSearchParams({ tab });
  if (extra) {
    for (const [k, v] of Object.entries(extra)) q.set(k, v);
  }
  return `/pozadavky?${q.toString()}`;
}

function resolveTab(raw: string | null): TabId {
  if (raw === "helpdesk") return "helpdesk";
  if (raw === "reseni") return "reseni";
  if (raw === "externi") return "externi";
  if (raw === "sit") return "sit";
  return "technika";
}

export function PozadavkyClient({
  profile,
  troubleCategories,
}: {
  profile: UserProfile;
  troubleCategories: TroubleCategory[];
}) {
  const searchParams = useSearchParams();
  const tab = resolveTab(searchParams?.get("tab") ?? null);

  const tabs: { id: TabId; label: string; icon: typeof ClipboardList }[] = [
    { id: "technika", label: "Technika", icon: ClipboardList },
    { id: "helpdesk", label: "Helpdesk", icon: Headphones },
    { id: "externi", label: "Externí dodavatelé", icon: Building2 },
    { id: "sit", label: "Síť / IP", icon: Network },
    { id: "reseni", label: "Řešení problémů", icon: BookOpen },
  ];

  return (
    <>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <ClipboardList className="h-7 w-7 text-red-600" />
          IT požadavky
        </h1>
        <p className="mt-1 text-gray-600">
          Požadavky na techniku, helpdesk, externí dodavatele a řešení běžných problémů
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200">
        {tabs.map(({ id, label, icon: Icon }) => (
          <Link
            key={id}
            href={tabHref(id)}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium ${
              tab === id
                ? "border-red-600 text-red-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </div>

      {tab === "technika" && <TechnikaTab profile={profile} />}
      {tab === "helpdesk" && <HelpdeskTab />}
      {tab === "externi" && <ExterniDodavateleTab />}
      {tab === "sit" && <SitIpTab />}
      {tab === "reseni" && <ReseniProblemuTab categories={troubleCategories} />}
    </>
  );
}
