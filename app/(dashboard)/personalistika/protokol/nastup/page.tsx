import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { getEmployeeOnboardingProtocol } from "@/lib/personalistika-employees";
import { ProtocolPrintBar } from "@/app/(dashboard)/equipment/protokol/ProtocolPrintBar";
import { ProtocolAutoPrint } from "@/app/(dashboard)/equipment/protokol/ProtocolAutoPrint";

export default async function PersonalistikaNastupProtokolPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string }>;
}) {
  const sp = await searchParams;
  const employeeId = parseInt(sp.employeeId ?? "", 10);
  if (!Number.isFinite(employeeId)) notFound();

  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  if (!(await hasModuleAccess(userId, "personalistika", "read"))) notFound();

  const data = await getEmployeeOnboardingProtocol(employeeId);
  if (!data) notFound();

  const { employee, checklist, equipment } = data;
  const fullName = `${employee.last_name} ${employee.first_name}`;
  const typeLabel = employee.employment_type === "delnik" ? "Dělnická" : "THP";
  const startDay = employee.start_date
    ? new Date(employee.start_date).toLocaleDateString("cs-CZ")
    : "—";

  return (
    <>
      <ProtocolAutoPrint />
      <div className="equipment-protocol-print mx-auto px-2 py-4">
        <ProtocolPrintBar backHref="/personalistika" />

        <div className="ep-header">
          <h1>NÁSTUPNÍ PROTOKOL</h1>
          <p style={{ margin: "5px 0", fontSize: "11px" }}>
            Potvrzení předání přístupů, vybavení a nastavení při nástupu
          </p>
        </div>

        <div className="ep-section">
          <div className="ep-section-title">INFORMACE O ZAMĚSTNANCI</div>
          <div className="ep-grid">
            <div>
              <div className="ep-label">Jméno a příjmení</div>
              <div className="ep-value">{fullName}</div>
            </div>
            <div>
              <div className="ep-label">Typ pozice</div>
              <div className="ep-value">{typeLabel}</div>
            </div>
            <div>
              <div className="ep-label">Pozice / zařazení</div>
              <div className="ep-value">{employee.position_title || "—"}</div>
            </div>
            <div>
              <div className="ep-label">E-mail</div>
              <div className="ep-value">{employee.email || "—"}</div>
            </div>
            <div>
              <div className="ep-label">Telefon</div>
              <div className="ep-value">{employee.phone || "—"}</div>
            </div>
            <div>
              <div className="ep-label">Datum nástupu</div>
              <div className="ep-value">{startDay}</div>
            </div>
          </div>
        </div>

        <div className="ep-section">
          <div className="ep-section-title">CHECKLIST NÁSTUPU</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "4px" }}>Položka</th>
                <th
                  style={{
                    textAlign: "center",
                    borderBottom: "1px solid #ccc",
                    padding: "4px",
                    width: "90px",
                  }}
                >
                  Předáno / nastaveno
                </th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "4px" }}>
                  Poznámka
                </th>
              </tr>
            </thead>
            <tbody>
              {checklist.map((row) => (
                <tr key={row.key}>
                  <td style={{ padding: "4px", borderBottom: "1px solid #eee" }}>{row.label}</td>
                  <td style={{ padding: "4px", borderBottom: "1px solid #eee", textAlign: "center" }}>
                    {row.done ? "ANO" : "NE"}
                  </td>
                  <td style={{ padding: "4px", borderBottom: "1px solid #eee" }}>{row.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ep-section">
          <div className="ep-section-title">PŘIŘAZENÝ MAJETEK (aktivní)</div>
          {equipment.length === 0 ? (
            <p style={{ margin: "5px 0", fontSize: "10px" }}>Žádný aktivně přiřazený majetek.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "4px" }}>
                    Název
                  </th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "4px" }}>
                    Inventární č.
                  </th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "4px" }}>
                    Sériové č.
                  </th>
                </tr>
              </thead>
              <tbody>
                {equipment.map((eq) => (
                  <tr key={eq.assignment_id}>
                    <td style={{ padding: "4px", borderBottom: "1px solid #eee" }}>{eq.name}</td>
                    <td style={{ padding: "4px", borderBottom: "1px solid #eee" }}>
                      {eq.asset_tag || "—"}
                    </td>
                    <td style={{ padding: "4px", borderBottom: "1px solid #eee" }}>
                      {eq.serial_number || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p style={{ margin: "8px 0 0", fontSize: "9px", color: "#666" }}>
            Majetek se přiděluje v modulu Majetek (předávací protokol). Zde je přehled aktivních
            přiřazení v okamžiku tisku.
          </p>
        </div>

        {employee.notes ? (
          <div className="ep-section">
            <div className="ep-section-title">POZNÁMKA</div>
            <p style={{ margin: "5px 0", fontSize: "10px", whiteSpace: "pre-wrap" }}>{employee.notes}</p>
          </div>
        ) : null}

        <div className="ep-signatures">
          <div className="ep-sig-box">
            <p>
              <strong>Převzal (zaměstnanec):</strong>
            </p>
            <br />
            <br />
            <p>Podpis zaměstnance</p>
          </div>
          <div className="ep-sig-box">
            <p>
              <strong>Předal (personalista / IT):</strong>
            </p>
            <br />
            <br />
            <p>Podpis předávajícího</p>
          </div>
        </div>

        <div className="ep-footer">
          <p>INTEGRAF — Personalistika</p>
          <p>
            Protokol vygenerován:{" "}
            {new Date().toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" })}
          </p>
          <p>ID zaměstnance: {employee.id}</p>
        </div>
      </div>
    </>
  );
}
