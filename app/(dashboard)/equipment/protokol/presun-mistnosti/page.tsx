import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { canReadEquipment } from "@/lib/equipment/access";
import { getRoomTransferProtocolById } from "@/lib/equipment/room-transfer-protocol-data";
import { ProtocolPrintBar } from "../ProtocolPrintBar";
import { ProtocolAutoPrint } from "../ProtocolAutoPrint";

function fmtDate(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("cs-CZ");
}

function fmtPrice(p: unknown): string {
  if (p == null) return "—";
  const n = Number(p);
  if (Number.isNaN(n)) return "—";
  return `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(n)} Kč`;
}

export default async function PrintPresunMistnostiPage({
  searchParams,
}: {
  searchParams: Promise<{ historyId?: string }>;
}) {
  const sp = await searchParams;
  const hid = parseInt(sp.historyId ?? "", 10);
  if (isNaN(hid)) notFound();

  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;

  const data = await getRoomTransferProtocolById(hid);
  if (!data) notFound();
  if (!(await canReadEquipment(userId, data.equipment_items.category_id))) notFound();

  const eq = data.equipment_items;
  const who = `${data.users.last_name} ${data.users.first_name}`;

  return (
    <>
      <ProtocolAutoPrint />
      <div className="equipment-protocol-print mx-auto px-2 py-4">
        <ProtocolPrintBar backHref={`/equipment/${eq.id}`} />

        <div className="ep-header">
          <h1>PROTOKOL O PŘESUNU MAJETKU</h1>
          <p style={{ margin: "5px 0", fontSize: "11px" }}>
            Číslo: {data.protocol_number ?? `PM-${data.id}`}
          </p>
        </div>

        <table className="ep-table" style={{ width: "100%", marginTop: 16 }}>
          <tbody>
            <tr>
              <th>Datum přesunu</th>
              <td>{fmtDate(data.transferred_at)}</td>
            </tr>
            <tr>
              <th>Provedl</th>
              <td>{who}</td>
            </tr>
            <tr>
              <th>Zdroj</th>
              <td>{data.source}</td>
            </tr>
            <tr>
              <th>Z místnosti</th>
              <td>
                {data.room_from
                  ? `${data.room_from.code} – ${data.room_from.name}`
                  : "(bez umístění)"}
              </td>
            </tr>
            <tr>
              <th>Do místnosti</th>
              <td>
                {data.room_to.code} – {data.room_to.name}
              </td>
            </tr>
            <tr>
              <th>Majetek</th>
              <td>
                {eq.name}
                <br />
                Inventární č.: {eq.asset_tag ?? "—"} / S/N: {eq.serial_number ?? "—"}
                <br />
                Skupina: {eq.equipment_categories.name}
                <br />
                Hodnota: {fmtPrice(eq.purchase_price)}
              </td>
            </tr>
            {data.notes ? (
              <tr>
                <th>Poznámka</th>
                <td>{data.notes}</td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <div style={{ marginTop: 48, display: "flex", justifyContent: "space-between" }}>
          <div style={{ width: "45%", borderTop: "1px solid #000", paddingTop: 4, fontSize: 11 }}>
            Předávající
          </div>
          <div style={{ width: "45%", borderTop: "1px solid #000", paddingTop: 4, fontSize: 11 }}>
            Přebírající
          </div>
        </div>
      </div>
    </>
  );
}
