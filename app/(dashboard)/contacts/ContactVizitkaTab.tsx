"use client";

import { useState } from "react";
import { Copy, Check, Download, Loader2 } from "lucide-react";

/** Stejná cesta jako v generátoru podpisu — načte se z aplikace a vloží se do .htm jako base64. */
const LOGO_PUBLIC_PATH = "/vizitka-integraf-logo.png";

type Props = {
  vizitkaHtml: string;
  podpisHtml: string;
};

/** Nahradí u prvního <img> atribut src data URL (obrázek přímo v HTML — funguje u file:// i offline). */
function replaceFirstImgSrc(html: string, dataUrl: string): string {
  return html.replace(/(<img\b[^>]*\bsrc=")([^"]*)(")/i, (_, before, _src, after) => `${before}${dataUrl}${after}`);
}

async function embedLogoInSignatureHtml(fragment: string): Promise<{ html: string; embedded: boolean }> {
  try {
    const res = await fetch(LOGO_PUBLIC_PATH);
    if (!res.ok) return { html: fragment, embedded: false };
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    return { html: replaceFirstImgSrc(fragment, dataUrl), embedded: true };
  } catch {
    return { html: fragment, embedded: false };
  }
}

function wrapSignatureAsHtm(fragment: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>body{margin:0;padding:24px;background:#f5f5f5;}</style>
</head>
<body>
${fragment}
</body>
</html>`;
}

async function downloadHtmFile(html: string, filename: string, title: string): Promise<boolean> {
  const { html: withLogo, embedded } = await embedLogoInSignatureHtml(html);
  if (!embedded) {
    window.alert(
      "Logo se nepodařilo načíst z aplikace (chybí soubor public/vizitka-integraf-logo.png). " +
        "Stáhne se soubor bez vloženého obrázku."
    );
  }
  const full = wrapSignatureAsHtm(withLogo, title);
  const blob = new Blob([full], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return embedded;
}

function VariantCard({
  title,
  description,
  html,
  previewClassName,
  downloadName,
  downloadTitle,
}: {
  title: string;
  description: string;
  html: string;
  previewClassName: string;
  downloadName: string;
  downloadTitle: string;
}) {
  const [copied, setCopied] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);

  const copyHtml = async () => {
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // výběr v textarea
    }
  };

  const downloadHtm = async () => {
    setDownloadBusy(true);
    try {
      await downloadHtmFile(html, downloadName, downloadTitle);
    } finally {
      setDownloadBusy(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-lg border border-gray-200 bg-gray-50/80 p-4">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-xs text-gray-600">{description}</p>

      <div className="mt-4 flex flex-1 justify-center overflow-x-auto rounded-md bg-white py-6 ring-1 ring-gray-200">
        <div
          className={previewClassName}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={downloadHtm}
          disabled={downloadBusy}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
        >
          {downloadBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {downloadBusy ? "Připravuji…" : `Stáhnout ${downloadName}`}
        </button>
        <button
          type="button"
          onClick={copyHtml}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          {copied ? "HTML zkopírováno" : "Kopírovat HTML"}
        </button>
      </div>
    </div>
  );
}

export function ContactVizitkaTab({ vizitkaHtml, podpisHtml }: Props) {
  return (
    <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <p className="font-medium">Proč se podpis v prohlížeči nezobrazí jako vizitka?</p>
        <p className="mt-2 text-amber-900/90">
          Outlook v prohlížeči (OWA) <strong>nezpracuje vložené HTML jako HTML</strong> — vloží ho jako čistý text.
          Stejně tak když HTML vložíte přímo do těla e-mailu nebo do podpisu jen přes Ctrl+V v OWA.
        </p>
        <p className="mt-2 text-amber-900/90">
          Správně to umí <strong>Outlook pro Windows (desktop)</strong>: je potřeba zkopírovat{" "}
          <strong>vykreslený obsah</strong> z prohlížeče (ne zdrojový kód), nejlépe přes soubor{" "}
          <code className="rounded bg-amber-100/80 px-1">.htm</code>.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900">Doporučený postup (Outlook Desktop)</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-gray-700">
          <li>
            Stáhněte soubor <strong>vizitka.htm</strong> nebo <strong>podpis.htm</strong> tlačítkem u zvolené
            varianty.
          </li>
          <li>
            Soubor otevřete v <strong>Edge</strong> nebo <strong>Chrome</strong> (dvojklik nebo přetažení do okna
            prohlížeče).
          </li>
          <li>
            Na stránce <strong>označte myší celou vizitku / podpis</strong> a zkopírujte (
            <kbd className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs">Ctrl</kbd> +{" "}
            <kbd className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs">C</kbd>) — kopírujete{" "}
            <strong>vykreslený obsah</strong>, ne HTML kód.
          </li>
          <li>
            V Outlooku Desktop: <strong>Soubor → Možnosti → Pošta → Podpisy → Nový</strong> → do editoru podpisu vložte (
            <kbd className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs">Ctrl</kbd> +{" "}
            <kbd className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs">V</kbd>).
          </li>
        </ol>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-gray-700">Vyberte variantu</h3>
        <div className="flex flex-col gap-4 lg:flex-row">
          <VariantCard
            title="Vizitka"
            description="Layout podle fyzické vizitky (90×50 mm) — logo vpravo nahoře."
            html={vizitkaHtml}
            previewClassName="box-border h-[50mm] w-[90mm] shrink-0 overflow-hidden bg-white [&>table]:h-full [&>table]:w-full"
            downloadName="vizitka.htm"
            downloadTitle="Vizitka Integraf"
          />
          <VariantCard
            title="Podpis"
            description="E-mailový podpis — logo vlevo vedle adresy a kontaktů."
            html={podpisHtml}
            previewClassName="box-border shrink-0 bg-white px-2"
            downloadName="podpis.htm"
            downloadTitle="Podpis Integraf"
          />
        </div>
      </div>

      <p className="text-sm text-gray-600">
        Stažené soubory obsahují logo <strong>vložené přímo do souboru</strong> (base64), takže se zobrazí i po
        otevření z <code className="rounded bg-gray-100 px-1">file:///</code>.
      </p>
    </div>
  );
}
