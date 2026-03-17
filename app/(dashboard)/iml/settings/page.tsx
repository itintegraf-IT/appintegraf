import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Package, ArrowLeft } from "lucide-react";
import { ImlCustomFieldsClient } from "./ImlCustomFieldsClient";

export default async function ImlSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  const canWrite = await hasModuleAccess(userId, "iml", "write");

  if (!canWrite) redirect("/iml");

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Package className="h-7 w-7 text-red-600" />
            Nastavení IML – Vlastní pole
          </h1>
          <p className="mt-1 text-gray-600">
            Přidejte vlastní pole k produktům a objednávkám
          </p>
        </div>
        <Link
          href="/iml"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Přehled IML
        </Link>
      </div>

      <ImlCustomFieldsClient />
    </>
  );
}
