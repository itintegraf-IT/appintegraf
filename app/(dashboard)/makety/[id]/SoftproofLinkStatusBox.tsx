import { formatDateTimeCz } from "@/lib/datetime-cz";
import {
  softproofLinkAccess,
  type SoftproofLinkAccess,
} from "@/lib/makety-softproof-links";

export type SoftproofLinkStatusData = {
  sent_to_email: string;
  created_at: Date;
  expires_at: Date;
  used_at: Date | null;
  used_action: string | null;
};

function accessLabel(
  access: SoftproofLinkAccess,
  usedAction: string | null
): string {
  switch (access) {
    case "ok":
      return "Platný";
    case "expired":
      return "Vypršel";
    case "revoked":
      return "Zrušen";
    case "used":
      if (usedAction === "approved") return "Použit (schváleno)";
      if (usedAction === "rejected") return "Použit (zamítnuto)";
      return "Použit";
    default:
      return access;
  }
}

function accessTone(access: SoftproofLinkAccess): string {
  switch (access) {
    case "ok":
      return "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100";
    case "expired":
    case "revoked":
      return "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100";
    case "used":
      return "border-gray-200 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-100";
    default:
      return "border-gray-200 bg-gray-50 text-gray-900";
  }
}

type Props = {
  link: SoftproofLinkStatusData;
};

export function SoftproofLinkStatusBox({ link }: Props) {
  const access = softproofLinkAccess({
    used_at: link.used_at,
    used_action: link.used_action,
    expires_at: link.expires_at,
  });

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${accessTone(access)}`}
    >
      <p className="font-medium">Poslední softproof odkaz</p>
      <dl className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
        <div>
          <dt className="opacity-70">Příjemce</dt>
          <dd>{link.sent_to_email || "—"}</dd>
        </div>
        <div>
          <dt className="opacity-70">Stav</dt>
          <dd>{accessLabel(access, link.used_action)}</dd>
        </div>
        <div>
          <dt className="opacity-70">Odesláno</dt>
          <dd>{formatDateTimeCz(link.created_at)}</dd>
        </div>
        <div>
          <dt className="opacity-70">Platnost do</dt>
          <dd>{formatDateTimeCz(link.expires_at)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs opacity-90">
        Pro obnovení platnosti znovu odešlete softproof — klient dostane nový
        odkaz.
      </p>
    </div>
  );
}
