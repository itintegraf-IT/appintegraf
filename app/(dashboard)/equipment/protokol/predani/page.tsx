import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { getAssignmentProtocolById } from "@/lib/equipment-protocol-data";
import { ProtocolPrintBar } from "../ProtocolPrintBar";
import { ProtocolAutoPrint } from "../ProtocolAutoPrint";

function fmtDate(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("cs-CZ");
}

function fmtPrice(p: Decimal | null): string | null {
  if (p == null) return null;
  const n = Number(p);
  if (Number.isNaN(n)) return null;
  return `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(n)} Kč`;
}

export default async function PrintPredaniPage({
  searchParams,
}: {
  searchParams: Promise<{ assignmentId?: string }>;
}) {
  const sp = await searchParams;
  const aid = parseInt(sp.assignmentId ?? "", 10);
  if (isNaN(aid)) notFound();

  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  if (!(await hasModuleAccess(userId, "equipment", "read"))) notFound();

  const data = await getAssignmentProtocolById(aid);
  if (!data) notFound();

  const { user, equipment } = data;
  const fullName = `${user.last_name} ${user.first_name}`;
  const brandModel = [equipment.brand, equipment.model].filter(Boolean).join(" ").trim();
  const priceStr = fmtPrice(equipment.purchase_price);

  return (
    <>
      <ProtocolAutoPrint />
      <div className="equipment-protocol-print mx-auto px-2 py-4">
        <ProtocolPrintBar backHref={`/equipment/${equipment.id}`} />

        <div className="ep-header">
          <h1>PŘEDÁVACÍ PROTOKOL</h1>
          <p style={{ margin: "5px 0", fontSize: "11px" }}>Přiřazení majetku zaměstnanci</p>
        </div>

        <div className="ep-section">
          <div className="ep-section-title">INFORMACE O ZAMĚSTNANCI</div>
          <div className="ep-grid">
            <div>
              <div className="ep-label">Jméno a příjmení</div>
              <div className="ep-value">{fullName}</div>
            </div>
            <div>
              <div className="ep-label">Pozice</div>
              <div className="ep-value">{user.position ?? "—"}</div>
            </div>
            <div>
              <div className="ep-label">Oddělení</div>
              <div className="ep-value">{user.department_name ?? "—"}</div>
            </div>
            <div>
              <div className="ep-label">E-mail</div>
              <div className="ep-value">{user.email ?? "—"}</div>
            </div>
          </div>
        </div>

        <div className="ep-section">
          <div className="ep-section-title">INFORMACE O VYBAVENÍ</div>
          <div className="ep-grid">
            <div>
              <div className="ep-label">Název</div>
              <div className="ep-value">{equipment.name}</div>
            </div>
            <div>
              <div className="ep-label">Značka a model</div>
              <div className="ep-value">{brandModel || "—"}</div>
            </div>
            <div>
              <div className="ep-label">Sériové číslo</div>
              <div className="ep-value font-mono">{equipment.serial_number ?? "—"}</div>
            </div>
            <div>
              <div className="ep-label">Datum pořízení</div>
              <div className="ep-value">{fmtDate(equipment.purchase_date)}</div>
            </div>
            {priceStr && (
              <div>
                <div className="ep-label">Pořizovací cena</div>
                <div className="ep-value">{priceStr}</div>
              </div>
            )}
          </div>
        </div>

        <div className="ep-section">
          <div className="ep-section-title">PODMÍNKY PŘEDÁNÍ</div>
          <div style={{ fontSize: "10px" }}>
            <p style={{ margin: "5px 0" }}>
              Vybavení bylo předáno dne:{" "}
              <strong>{fmtDate(data.assigned_at)}</strong>
            </p>
            {data.notes && (
              <>
                <p style={{ margin: "5px 0" }}>
                  <strong>Poznámka:</strong>
                </p>
                <p style={{ margin: "5px 0", whiteSpace: "pre-wrap" }}>{data.notes}</p>
              </>
            )}
          </div>
        </div>

        <div className="ep-signatures">
          <div className="ep-sig-box">
            <p>
              <strong>Předal:</strong>
            </p>
            <br />
            <br />
            <p>Podpis správce majetku</p>
          </div>
          <div className="ep-sig-box">
            <p>
              <strong>Převzal:</strong>
            </p>
            <br />
            <br />
            <p>Podpis zaměstnance</p>
          </div>
        </div>

        <div className="ep-footer">
          <p>INTEGRAF - Systém správy majetku</p>
          <p>
            Protokol vygenerován:{" "}
            {new Date().toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" })}
          </p>
          <p>ID přiřazení: {data.assignmentId}</p>
        </div>
      </div>
    </>
  );
}
