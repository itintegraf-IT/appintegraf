"use client";

import { useEffect, useState } from "react";
import { Copy, ExternalLink, Check } from "lucide-react";

export function KioskMonitorUrl({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const [absolute, setAbsolute] = useState(path);

  useEffect(() => {
    setAbsolute(`${window.location.origin}${path}`);
  }, [path]);

  const copy = async () => {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
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
  );
}
