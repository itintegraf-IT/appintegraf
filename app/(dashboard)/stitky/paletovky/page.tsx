import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { canReadStitky, canWriteStitkyOrder } from "@/lib/stitky/access";

export const dynamic = "force-dynamic";

export default async function PaletovkyListPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await canReadStitky(userId))) redirect("/");

  const canWrite = await canWriteStitkyOrder(userId);

  const rows = await prisma.stitky_paletovky.findMany({
    orderBy: { updated_at: "desc" },
    take: 100,
    include: {
      template: { select: { name: true, layout_variant: true } },
      users_creator: { select: { first_name: true, last_name: true } },
    },
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Paletovky</h2>
        <div className="flex flex-wrap gap-2">
          {canWrite && (
            <Link
              href="/stitky/paletovky/new"
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Nová paletovka
            </Link>
          )}
          <Link
            href="/stitky/paletovky/templates"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            Šablony
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-3">Název</th>
              <th className="px-4 py-3">Šablona</th>
              <th className="px-4 py-3">Layout</th>
              <th className="px-4 py-3">Stav</th>
              <th className="px-4 py-3">Autor</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Zatím žádné paletovky
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{r.title}</td>
                  <td className="px-4 py-3">{r.template.name}</td>
                  <td className="px-4 py-3">{r.template.layout_variant}</td>
                  <td className="px-4 py-3">{r.status}</td>
                  <td className="px-4 py-3">
                    {r.users_creator.first_name} {r.users_creator.last_name}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/stitky/paletovky/${r.id}`} className="text-red-700 hover:underline">
                      Otevřít
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
