"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, FileSignature, PenLine, Archive } from "lucide-react";
import { ContractApprovalStatus } from "@/lib/contracts/workflow-status";

type Props = {
  contractId: number;
  approvalStatus: string;
  canManage: boolean;
};

export function ContractLifecyclePanel({ contractId, approvalStatus, canManage }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [signedAt, setSignedAt] = useState("");

  if (!canManage) return null;

  async function postTransition(action: "begin_signature" | "sign" | "archive") {
    setError("");
    setLoading(action);
    try {
      const body: Record<string, unknown> = { action };
      if (action === "sign" && signedAt.trim()) {
        body.signed_at = new Date(signedAt).toISOString();
      }
      const res = await fetch(`/api/contracts/${contractId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Akce se nezdařila");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba");
    } finally {
      setLoading(null);
    }
  }

  const showBegin =
    approvalStatus === ContractApprovalStatus.APPROVAL_COMPLETED;
  const showSign = approvalStatus === ContractApprovalStatus.SIGNATURE_PENDING;
  const showArchive = approvalStatus === ContractApprovalStatus.SIGNED;

  if (!showBegin && !showSign && !showArchive) return null;

  return (
    <div
      className="rounded-xl border bg-card p-4 shadow-sm space-y-4"
      style={{ borderColor: "var(--border)" }}
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Podpis a archivace
      </h2>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {showBegin && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground flex-1 min-w-[200px]">
            Schvalování je dokončeno. Přejděte do fáze podpisu.
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => postTransition("begin_signature")}
            disabled={loading !== null}
          >
            {loading === "begin_signature" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <FileSignature className="mr-2 h-4 w-4" />
                Připravit k podpisu
              </>
            )}
          </Button>
        </div>
      )}

      {showSign && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Zapište datum podpisu smlouvy (výchozí je dnes).
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="signed-at">Datum a čas podpisu</Label>
              <Input
                id="signed-at"
                type="datetime-local"
                value={signedAt}
                onChange={(e) => setSignedAt(e.target.value)}
              />
            </div>
            <Button
              type="button"
              onClick={() => postTransition("sign")}
              disabled={loading !== null}
            >
              {loading === "sign" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <PenLine className="mr-2 h-4 w-4" />
                  Zapsat podpis
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {showArchive && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground flex-1 min-w-[200px]">
            Smlouva je podepsána. Můžete ji přesunout do archivu.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!confirm("Archivovat tuto smlouvu?")) return;
              postTransition("archive");
            }}
            disabled={loading !== null}
          >
            {loading === "archive" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Archive className="mr-2 h-4 w-4" />
                Archivovat
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
