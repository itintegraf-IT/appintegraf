import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasModuleAccess } from "@/lib/auth-utils";
import { ArrowLeft, Layers } from "lucide-react";

export default async function TechnologieCiselnikyHubPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "technologie", "write"))) redirect("/technologie");

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href="/technologie"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Zpět na Technologie
      </Link>
      <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900">
        <Layers className="h-7 w-7 text-red-600" />
        Číselníky
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        Typy archů jsou specifické pro Technologie. Stroje jsou společné s modulem Výkresy
        (skupiny Press / Postpress).
      </p>
      <ul className="mt-6 space-y-3">
        <li>
          <Link
            href="/technologie/ciselniky/typy"
            className="block rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm hover:border-red-200"
          >
            <span className="font-medium text-gray-900">Typy archů</span>
            <span className="mt-1 block text-sm text-gray-500">
              volný list, V1, V2, V4, V8…
            </span>
          </Link>
        </li>
        <li>
          <Link
            href="/stroje?from=technologie"
            className="block rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm hover:border-red-200"
          >
            <span className="font-medium text-gray-900">Stroje (společný číselník)</span>
            <span className="mt-1 block text-sm text-gray-500">
              Press: XL 105… · Postpress: společně s Výkresy
            </span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
