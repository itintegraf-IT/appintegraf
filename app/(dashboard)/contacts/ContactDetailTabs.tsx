"use client";

import { useState } from "react";
import { Mail, Phone } from "lucide-react";

type Props = {
  personalPhone: string | null;
  personalEmail: string | null;
  children: React.ReactNode;
};

export function ContactDetailTabs({ personalPhone, personalEmail, children }: Props) {
  const [tab, setTab] = useState<"overview" | "personal">("overview");

  return (
    <>
      <div className="mb-4 flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
        <button
          type="button"
          onClick={() => setTab("overview")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "overview" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Přehled
        </button>
        <button
          type="button"
          onClick={() => setTab("personal")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "personal" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Osobní údaje
        </button>
      </div>

      {tab === "overview" ? (
        children
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="mb-4 text-sm text-gray-500">
            Slouží pouze k evidenci, nepoužívá se pro přihlášení ani jiné funkce systému.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Osobní telefon</p>
                <p className="mt-1 text-gray-900">{personalPhone ?? "—"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Osobní e-mail</p>
                {personalEmail ? (
                  <a href={`mailto:${personalEmail}`} className="mt-1 block text-red-600 hover:underline">
                    {personalEmail}
                  </a>
                ) : (
                  <p className="mt-1 text-gray-900">—</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
