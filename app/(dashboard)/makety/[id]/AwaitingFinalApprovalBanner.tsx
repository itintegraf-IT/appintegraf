"use client";

type Props = {
  clientEmail?: string | null;
};

export function AwaitingFinalApprovalBanner({ clientEmail }: Props) {
  function focusWorkflow() {
    const el = document.getElementById("grafika-status-panel");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.dispatchEvent(new CustomEvent("makety:select-final-approve"));
  }

  return (
    <div className="rounded-xl border-2 border-teal-400 bg-teal-50 px-4 py-3 text-sm text-teal-950 shadow-sm dark:border-teal-700 dark:bg-teal-950/40 dark:text-teal-100">
      <p className="font-semibold">Klient schválil softproof — čeká finální schválení</p>
      <p className="mt-1">
        Softproof
        {clientEmail ? ` (${clientEmail})` : ""} byl schválen klientem. Stav zůstává „odesláno ke
        schválení“, dokud nedokončíte finální schválení ve workflow.
      </p>
      <button
        type="button"
        onClick={focusWorkflow}
        className="mt-3 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
      >
        Schválit finálně (schváleno klientem)
      </button>
    </div>
  );
}
