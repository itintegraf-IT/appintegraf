import Link from "next/link";
import { redirect } from "next/navigation";
import { Info } from "lucide-react";
import { auth } from "@/auth";
import { canAdministerEquipment } from "@/lib/equipment/access";

/** Fond předtištěných QR kódů se nepoužívá — štítek se tiskne až po zařazení (rozhodnutí 10/2026). */
export default async function QrPoolPage() {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  if (!(await canAdministerEquipment(userId))) redirect("/equipment");

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 py-6">
      <div role="status" className="flex items-start gap-3 rounded-xl border border-border bg-card p-6 shadow-sm">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        <div>
          <h1 className="text-lg font-semibold">Fond QR se nepoužívá</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Štítek se tiskne až po zařazení majetku — v souhrnu zařazení, na detailu položky nebo v seznamu přes filtr
            Bez štítku. Inventární číslo tak vždy pochází z číselné řady a štítky se nepárují ručně.
          </p>
        </div>
      </div>
      <Link
        href="/equipment/settings"
        className="inline-flex min-h-11 w-fit items-center rounded-lg border border-border px-4 font-medium hover:bg-muted"
      >
        Zpět do nastavení
      </Link>
    </div>
  );
}
