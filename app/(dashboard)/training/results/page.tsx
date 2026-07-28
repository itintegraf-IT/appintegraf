import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { ArrowLeft, History, CheckCircle, XCircle } from "lucide-react";

function formatDateTime(date: Date): string {
  return date.toLocaleString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "–";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default async function MyResultsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "training", "read"))) redirect("/");

  const attempts = await prisma.test_attempts.findMany({
    where: { user_id: userId, completed_at: { not: null } },
    include: { tests: { select: { name: true, pass_percentage: true } } },
    orderBy: { started_at: "desc" },
    take: 100,
  });

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <History className="h-7 w-7 text-red-600" />
            Moje výsledky
          </h1>
          <p className="mt-1 text-gray-600">Historie vašich pokusů o testy</p>
        </div>
        <Link
          href="/training"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {attempts.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500">
            Zatím jste nevyplnili žádný test
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-600">
                <th className="px-4 py-3 font-medium">Test</th>
                <th className="px-4 py-3 font-medium">Datum</th>
                <th className="px-4 py-3 font-medium">Skóre</th>
                <th className="px-4 py-3 font-medium">Čas</th>
                <th className="px-4 py-3 font-medium">Výsledek</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {attempts.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{a.tests.name}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDateTime(a.started_at)}</td>
                  <td className="px-4 py-3 text-gray-900">
                    {a.score === null ? "–" : `${Number(a.score)}%`}
                    {a.tests.pass_percentage != null && (
                      <span className="ml-1 text-xs text-gray-400">
                        (min {a.tests.pass_percentage}%)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatDuration(a.time_spent)}</td>
                  <td className="px-4 py-3">
                    {a.passed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                        <CheckCircle className="h-3.5 w-3.5" /> Splněno
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                        <XCircle className="h-3.5 w-3.5" /> Nesplněno
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
