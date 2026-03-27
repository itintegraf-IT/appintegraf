import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, FileText, Download, Search, CalendarClock } from "lucide-react";
import { contractStatusLabel } from "@/lib/contracts/status-labels";
import { ContractApprovalStatus } from "@/lib/contracts/workflow-status";
import { buildContractsWhere, type ContractListFilters } from "@/lib/contracts/list-where";
import { countMyContractsExpiringWithin } from "@/lib/contracts/expiry-reminders";

function statusVariant(
  s: string
): "default" | "secondary" | "destructive" | "outline" {
  if (s === ContractApprovalStatus.REJECTED) return "destructive";
  if (s === ContractApprovalStatus.DRAFT || s === ContractApprovalStatus.RETURNED)
    return "secondary";
  if (s === ContractApprovalStatus.IN_APPROVAL) return "default";
  if (s === ContractApprovalStatus.APPROVAL_COMPLETED) return "outline";
  return "outline";
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("cs-CZ");
}

type PageParams = {
  status?: string;
  type?: string;
  q?: string;
  expiring?: string;
};

function contractsQueryString(
  current: PageParams,
  patch?: Partial<Record<keyof PageParams, string | null>>
): string {
  const next: PageParams = { ...current };
  if (patch) {
    for (const [k, v] of Object.entries(patch) as [keyof PageParams, string | null][]) {
      if (v === null || v === undefined || v === "") delete next[k];
      else next[k] = v;
    }
  }
  const sp = new URLSearchParams();
  if (next.q?.trim()) sp.set("q", next.q.trim());
  if (next.status) sp.set("status", next.status);
  if (next.type) sp.set("type", next.type);
  if (next.expiring) sp.set("expiring", next.expiring);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<PageParams>;
}) {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;

  const params = await searchParams;
  const exp =
    params.expiring === "30" || params.expiring === "60" || params.expiring === "90"
      ? parseInt(params.expiring, 10)
      : undefined;

  const filters: ContractListFilters = {
    approvalStatus: params.status,
    contractTypeId: params.type ? parseInt(params.type, 10) : undefined,
    search: params.q,
    expiringWithinDays: exp,
  };

  const where = buildContractsWhere(filters);

  const [contracts, total, myExpiring90, types] = await Promise.all([
    prisma.contracts.findMany({
      where,
      orderBy: { updated_at: "desc" },
      take: 100,
      include: {
        contract_types: { select: { name: true, code: true } },
        users_created_by: { select: { first_name: true, last_name: true } },
      },
    }),
    prisma.contracts.count({ where }),
    userId > 0 ? countMyContractsExpiringWithin(userId, 90) : Promise.resolve(0),
    prisma.contract_types.findMany({
      where: { is_active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const exportHref = `/api/contracts/export${contractsQueryString(params)}`;
  const cur = params;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Evidence smluv</h1>
            <p className="text-sm text-muted-foreground">
              Návrhy, schvalování a přehled smluv
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={exportHref}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </a>
          </Button>
          <Button asChild>
            <Link href="/contracts/new">
              <Plus className="mr-2 h-4 w-4" />
              Nová smlouva
            </Link>
          </Button>
        </div>
      </div>

      {userId > 0 && myExpiring90 > 0 && !params.expiring && (
        <div
          className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm dark:border-amber-900 dark:bg-amber-950/40"
        >
          <CalendarClock className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" />
          <span>
            Máte <strong>{myExpiring90}</strong> smluv s koncem platnosti nebo expirací do 90 dnů
            (jako autor nebo odpovědná osoba).
          </span>
          <Button variant="secondary" size="sm" asChild>
            <Link href="/contracts?expiring=90">Zobrazit</Link>
          </Button>
        </div>
      )}

      <form
        method="get"
        action="/contracts"
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap"
      >
        {params.status ? (
          <input type="hidden" name="status" value={params.status} />
        ) : null}
        {params.type ? <input type="hidden" name="type" value={params.type} /> : null}
        {params.expiring ? (
          <input type="hidden" name="expiring" value={params.expiring} />
        ) : null}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            type="search"
            placeholder="Hledat v názvu, čísle, stranách, popisu…"
            defaultValue={params.q ?? ""}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">
          Hledat
        </Button>
        {params.q ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/contracts${contractsQueryString(cur, { q: null })}`}>
              Zrušit hledání
            </Link>
          </Button>
        ) : null}
      </form>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Filtr stav:</span>
        <Link
          href={`/contracts${contractsQueryString(cur, { status: null })}`}
          className={`rounded-md px-2 py-1 hover:bg-muted ${!params.status ? "bg-muted font-medium" : ""}`}
        >
          Vše
        </Link>
        {[
          ContractApprovalStatus.DRAFT,
          ContractApprovalStatus.IN_APPROVAL,
          ContractApprovalStatus.APPROVAL_COMPLETED,
          ContractApprovalStatus.SIGNATURE_PENDING,
          ContractApprovalStatus.SIGNED,
          ContractApprovalStatus.ARCHIVED,
          ContractApprovalStatus.REJECTED,
        ].map((s) => (
          <Link
            key={s}
            href={`/contracts${contractsQueryString(cur, { status: s })}`}
            className={`rounded-md px-2 py-1 hover:bg-muted ${params.status === s ? "bg-muted font-medium" : ""}`}
          >
            {contractStatusLabel(s)}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Končí do:</span>
        {(
          [
            { days: "30", label: "30 dnů" },
            { days: "60", label: "60 dnů" },
            { days: "90", label: "90 dnů" },
          ] as const
        ).map(({ days, label }) => (
          <Link
            key={days}
            href={`/contracts${contractsQueryString(cur, { expiring: days })}`}
            className={`rounded-md px-2 py-1 hover:bg-muted ${params.expiring === days ? "bg-muted font-medium" : ""}`}
          >
            {label}
          </Link>
        ))}
        <Link
          href={`/contracts${contractsQueryString(cur, { expiring: null })}`}
          className={`rounded-md px-2 py-1 hover:bg-muted ${!params.expiring ? "bg-muted font-medium" : ""}`}
        >
          Bez filtru data
        </Link>
      </div>

      {types.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Typ:</span>
          <Link
            href={`/contracts${contractsQueryString(cur, { type: null })}`}
            className={`rounded-md px-2 py-1 hover:bg-muted ${!params.type ? "bg-muted font-medium" : ""}`}
          >
            Všechny
          </Link>
          {types.map((t) => (
            <Link
              key={t.id}
              href={`/contracts${contractsQueryString(cur, { type: String(t.id) })}`}
              className={`rounded-md px-2 py-1 hover:bg-muted ${params.type === String(t.id) ? "bg-muted font-medium" : ""}`}
            >
              {t.name}
            </Link>
          ))}
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        {total === 0
          ? "Žádný záznam."
          : total <= 100
            ? `Počet: ${total}`
            : `Zobrazeno prvních 100 z ${total} – zpřesněte filtry nebo export.`}
      </p>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm" style={{ borderColor: "var(--border)" }}>
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b bg-muted/50" style={{ borderColor: "var(--border)" }}>
              <th className="p-3 font-medium">Název</th>
              <th className="p-3 font-medium">Typ</th>
              <th className="p-3 font-medium">Stav</th>
              <th className="p-3 font-medium hidden md:table-cell">Platnost do</th>
              <th className="p-3 font-medium hidden md:table-cell">Expirace</th>
              <th className="p-3 font-medium">Autor</th>
              <th className="p-3 font-medium whitespace-nowrap">Upraveno</th>
            </tr>
          </thead>
          <tbody>
            {contracts.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  Žádné smlouvy.{" "}
                  <Link href="/contracts/new" className="text-primary underline">
                    Vytvořit první
                  </Link>
                </td>
              </tr>
            ) : (
              contracts.map((c) => (
                <tr
                  key={c.id}
                  className="border-b transition-colors hover:bg-muted/30"
                  style={{ borderColor: "var(--border)" }}
                >
                  <td className="p-3">
                    <Link
                      href={`/contracts/${c.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {c.title}
                    </Link>
                    {c.contract_number && (
                      <span className="ml-2 text-muted-foreground">({c.contract_number})</span>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {c.contract_types?.name ?? "—"}
                  </td>
                  <td className="p-3">
                    <Badge variant={statusVariant(c.approval_status)}>
                      {contractStatusLabel(c.approval_status)}
                    </Badge>
                  </td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell whitespace-nowrap">
                    {formatDate(c.valid_until)}
                  </td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell whitespace-nowrap">
                    {formatDate(c.expires_at)}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {c.users_created_by
                      ? `${c.users_created_by.first_name} ${c.users_created_by.last_name}`
                      : "—"}
                  </td>
                  <td className="p-3 text-muted-foreground whitespace-nowrap">
                    {formatDate(c.updated_at)}
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
