"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Send, Check, X } from "lucide-react";
import { ContractApprovalStatus } from "@/lib/contracts/workflow-status";

type Props = {
  contractId: number;
  title: string;
  approvalStatus: string;
  currentUserId: number;
  createdBy: number;
  isAdmin: boolean;
  pendingApproverId: number | null;
};

export function ContractApprovalPanel({
  contractId,
  title,
  approvalStatus,
  currentUserId,
  createdBy,
  isAdmin,
  pendingApproverId,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [error, setError] = useState("");

  const canSubmit =
    (approvalStatus === ContractApprovalStatus.DRAFT ||
      approvalStatus === ContractApprovalStatus.RETURNED) &&
    (createdBy === currentUserId || isAdmin);

  const canApprove =
    approvalStatus === ContractApprovalStatus.IN_APPROVAL &&
    pendingApproverId === currentUserId;

  async function postSubmit() {
    setError("");
    setLoading("submit");
    try {
      const res = await fetch(`/api/contracts/${contractId}/submit`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Odeslání se nezdařilo");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba");
    } finally {
      setLoading(null);
    }
  }

  async function postApprove(action: "approve" | "reject") {
    setError("");
    if (action === "reject" && !rejectComment.trim()) {
      setError("U zamítnutí uveďte důvod.");
      return;
    }
    setLoading(action);
    try {
      const res = await fetch(`/api/contracts/${contractId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          comment: action === "reject" ? rejectComment.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Akce se nezdařila");
      setRejectComment("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba");
    } finally {
      setLoading(null);
    }
  }

  if (!canSubmit && !canApprove) {
    return null;
  }

  return (
    <div
      className="rounded-xl border bg-card p-4 shadow-sm space-y-4"
      style={{ borderColor: "var(--border)" }}
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Akce
      </h2>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {canSubmit && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground flex-1 min-w-[200px]">
            Odešlete návrh ke schválení podle šablony typu smlouvy.
          </p>
          <Button
            type="button"
            onClick={() => postSubmit()}
            disabled={loading !== null}
          >
            {loading === "submit" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Odeslat ke schválení
              </>
            )}
          </Button>
        </div>
      )}

      {canApprove && (
        <div className="space-y-3">
          <p className="text-sm font-medium">
            Jste na řadě ke schválení smlouvy „{title}“.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="default"
              onClick={() => postApprove("approve")}
              disabled={loading !== null}
            >
              {loading === "approve" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Schválit
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => postApprove("reject")}
              disabled={loading !== null || !rejectComment.trim()}
            >
              {loading === "reject" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <X className="mr-2 h-4 w-4" />
                  Zamítnout
                </>
              )}
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Důvod zamítnutí (povinný)</Label>
            <Textarea
              id="reject-reason"
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              rows={3}
              placeholder="Zadejte důvod…"
            />
          </div>
        </div>
      )}
    </div>
  );
}
