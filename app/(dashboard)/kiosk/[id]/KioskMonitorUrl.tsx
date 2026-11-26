"use client";

import { useEffect, useState } from "react";
import { Copy, ExternalLink, Check } from "lucide-react";

function copyTextFallback(text: string): boolean {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

export function KioskMonitorUrl({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [absolute, setAbsolute] = useState(path);

  useEffect(() => {
    setAbsolute(`${window.location.origin}${path}`);
  }, [path]);

  const copy = async () => {
    const url = `${window.location.origin}${path}`;
    setCopyError("");
    let ok = false;

    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        ok = true;
      } catch {
        ok = false;
      }
    }

    if (!ok) {
      ok = copyTextFallback(url);
    }

    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setCopyError("Kopírování selhalo — vyberte URL ručně (Ctrl+C)");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="flex-1 truncate rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
          {absolute}
        </code>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            {copied ? "Zkopírováno" : "Kopírovat"}
          </button>
          <a
            href={path}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <ExternalLink className="h-4 w-4" />
            Otevřít
          </a>
        </div>
      </div>
      {copyError ? <p className="text-xs text-red-600">{copyError}</p> : null}
    </div>
  );
}
