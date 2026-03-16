import { auth } from "@/auth";
import Link from "next/link";
import { Settings, User } from "lucide-react";

export default async function SettingsPage() {
  const session = await auth();

  return (
    <>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Settings className="h-7 w-7 text-red-600" />
          Nastavení
        </h1>
        <p className="mt-1 text-gray-600">Osobní nastavení a preference</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <Link
            href="/profile"
            className="flex items-center gap-4 rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50"
          >
            <div className="rounded-lg bg-red-100 p-3">
              <User className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Profil</p>
              <p className="text-sm text-gray-500">
                Upravit osobní údaje, kontaktní informace a heslo
              </p>
            </div>
          </Link>
        </div>
      </div>
    </>
  );
}
