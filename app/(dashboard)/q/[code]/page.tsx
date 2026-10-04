import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, Info, MapPin, Package } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canReadEquipment } from "@/lib/equipment/access";
import { decideQrLanding, type QrLandingContext } from "@/lib/equipment/qr-landing";
import { resolveScanCode } from "@/lib/equipment/scan-resolve";

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Odkaz z QR štítku (modul Majetek): najde položku nebo místnost a otevře její kartu. */
export default async function QrLandingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(`/q/${rawCode}`)}`);
  const userId = parseInt(session.user.id, 10);

  const { resolution } = await resolveScanCode(safeDecode(rawCode), "any");

  const ctx: QrLandingContext = { canReadItem: false, canReadRooms: await canReadEquipment(userId) };
  if (resolution.type === "item" || resolution.type === "ambiguous") {
    const item = await prisma.equipment_items.findUnique({
      where: { id: resolution.itemId },
      select: { category_id: true, name: true, asset_tag: true, qr_code: true },
    });
    if (item) {
      ctx.canReadItem = await canReadEquipment(userId, item.category_id);
      ctx.itemLabel = `${item.asset_tag ?? item.qr_code ?? ""} — ${item.name}`;
    }
  }
  if (resolution.type === "ambiguous") {
    const room = await prisma.equipment_rooms.findUnique({
      where: { id: resolution.roomId },
      select: { code: true, name: true },
    });
    if (room) ctx.roomLabel = `${room.code} — ${room.name}`;
  }

  const landing = decideQrLanding(resolution, ctx);
  if (landing.kind === "redirect") redirect(landing.href);

  const linkClass =
    "flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 py-2 font-medium hover:bg-muted";

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 py-10">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        {landing.kind === "choose" ? (
          <>
            <h1 className="text-lg font-semibold">Kód patří položce i místnosti</h1>
            <p className="mt-1 text-sm text-muted-foreground">Vyberte, co chcete otevřít.</p>
            <div className="mt-4 flex flex-col gap-2">
              <Link href={landing.item.href} className={linkClass}>
                <Package className="h-5 w-5 shrink-0" aria-hidden />
                <span className="min-w-0 truncate">Položka {landing.item.label}</span>
              </Link>
              <Link href={landing.room.href} className={linkClass}>
                <MapPin className="h-5 w-5 shrink-0" aria-hidden />
                <span className="min-w-0 truncate">Místnost {landing.room.label}</span>
              </Link>
            </div>
          </>
        ) : (
          <div role={landing.tone === "warning" ? "alert" : "status"} className="flex items-start gap-3">
            {landing.tone === "warning" ? (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-(--warning)" aria-hidden />
            ) : (
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <div>
              <h1 className="text-lg font-semibold">{landing.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{landing.text}</p>
            </div>
          </div>
        )}
        <Link href="/equipment" className={`${linkClass} mt-6 w-fit`}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Přejít do Majetku
        </Link>
      </div>
    </div>
  );
}
