"use client";

import { useCallback, useRef, useState } from "react";
import { Download, ExternalLink, PlayCircle } from "lucide-react";
import { parseMaterialType } from "@/lib/training/material-types";
import type { MaterialFileMeta } from "@/lib/training/material-shared";
import { getMaterialFileServeUrl } from "@/lib/training/material-shared";
import { resolveVideoEmbed } from "@/lib/training/video-embed";

type Props = {
  materialId: number;
  materialType: string;
  content: string;
  mediaUrl: string | null;
  file: MaterialFileMeta | null;
};

export function MaterialMediaContent({ materialId, materialType, content, mediaUrl, file }: Props) {
  const type = parseMaterialType(materialType);

  return (
    <>
      {content.trim() && (
        <div className="prose mb-6 max-w-none">
          <div className="whitespace-pre-wrap text-gray-700">{content}</div>
        </div>
      )}

      {type === "text" && !content.trim() && (
        <p className="text-gray-500">Materiál nemá obsah.</p>
      )}

      {type === "video" && (
        <VideoContent materialId={materialId} mediaUrl={mediaUrl} file={file} />
      )}

      {type === "presentation" && (
        <PresentationContent materialId={materialId} file={file} />
      )}
    </>
  );
}

function MediaActions({
  src,
  onDownload,
  downloading,
  downloadLabel = "Stáhnout",
}: {
  src: string;
  onDownload?: () => void;
  downloading?: boolean;
  downloadLabel?: string;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={() => window.open(src, "_blank", "noopener,noreferrer")}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Otevřít v novém okně
      </button>
      {onDownload && (
        <button
          type="button"
          onClick={onDownload}
          disabled={downloading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" />
          {downloading ? "Stahuji…" : downloadLabel}
        </button>
      )}
    </div>
  );
}

function VideoFilePlayer({ src, filename }: { src: string; filename: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackError, setPlaybackError] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const downloadUrl = `${src}${src.includes("?") ? "&" : "?"}download=1`;

  const onError = useCallback(() => setPlaybackError(true), []);

  const downloadFile = async () => {
    setDownloading(true);
    try {
      const res = await fetch(downloadUrl, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Stažení se nezdařilo. Zkuste to znovu nebo kontaktujte administrátora.");
    } finally {
      setDownloading(false);
    }
  };

  const openInNewTab = () => {
    window.open(src, "_blank", "noopener,noreferrer");
  };

  if (playbackError) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
        <PlayCircle className="h-12 w-12 text-gray-400" />
        <p className="text-gray-700">
          Video se nepodařilo přehrát v prohlížeči (<strong>{filename}</strong>).
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={openInNewTab}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            <ExternalLink className="h-4 w-4" />
            Otevřít v novém okně
          </button>
          <button
            type="button"
            onClick={() => void downloadFile()}
            disabled={downloading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {downloading ? "Stahuji…" : "Stáhnout video"}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Stáhněte soubor a otevřete ho v systémovém přehrávači (VLC, Windows Media Player apod.)
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <video
        ref={videoRef}
        controls
        className="w-full rounded-lg bg-black"
        preload="metadata"
        src={src}
        onError={onError}
      >
        Váš prohlížeč nepodporuje přehrávání videa.
      </video>
      <div className="flex justify-end gap-2">
        <MediaActions
          src={src}
          onDownload={() => void downloadFile()}
          downloading={downloading}
        />
      </div>
    </div>
  );
}

function VideoContent({
  materialId,
  mediaUrl,
  file,
}: {
  materialId: number;
  mediaUrl: string | null;
  file: MaterialFileMeta | null;
}) {
  if (file) {
    const src = file.serve_url || getMaterialFileServeUrl(materialId);
    return <VideoFilePlayer src={src} filename={file.original_filename} />;
  }

  if (mediaUrl) {
    const embed = resolveVideoEmbed(mediaUrl);
    if (embed?.kind === "iframe") {
      return (
        <div className="space-y-2">
          <div className="aspect-video overflow-hidden rounded-lg bg-black">
            <iframe
              src={embed.embedUrl}
              title="Video"
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <MediaActions src={embed.embedUrl} />
        </div>
      );
    }
    if (embed?.kind === "video") {
      return (
        <div className="space-y-2">
          <video controls className="w-full rounded-lg bg-black" src={embed.src}>
            Váš prohlížeč nepodporuje přehrávání videa.
          </video>
          <MediaActions src={embed.src} />
        </div>
      );
    }
    if (embed?.kind === "link") {
      return (
        <a
          href={embed.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          <ExternalLink className="h-4 w-4" />
          Otevřít video
        </a>
      );
    }
  }

  return <p className="text-gray-500">Video není k dispozici.</p>;
}

function PresentationContent({
  materialId,
  file,
}: {
  materialId: number;
  file: MaterialFileMeta | null;
}) {
  const [downloading, setDownloading] = useState(false);

  if (!file) {
    return <p className="text-gray-500">Prezentace není k dispozici.</p>;
  }

  const src = file.serve_url || getMaterialFileServeUrl(materialId);
  const downloadUrl = `${src}${src.includes("?") ? "&" : "?"}download=1`;
  const isPdf = file.mime_type === "application/pdf" || file.file_path.toLowerCase().endsWith(".pdf");

  const downloadFile = async () => {
    setDownloading(true);
    try {
      const res = await fetch(downloadUrl, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.original_filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Stažení se nezdařilo. Zkuste to znovu nebo kontaktujte administrátora.");
    } finally {
      setDownloading(false);
    }
  };

  if (isPdf) {
    return (
      <div className="space-y-2">
        <MediaActions
          src={src}
          onDownload={() => void downloadFile()}
          downloading={downloading}
          downloadLabel="Stáhnout PDF"
        />
        <iframe
          src={src}
          title={file.original_filename}
          className="h-[70vh] w-full rounded-lg border border-gray-200"
        />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
      <p className="mb-4 text-gray-700">
        Prezentace <strong>{file.original_filename}</strong> je k dispozici ke stažení.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => window.open(src, "_blank", "noopener,noreferrer")}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          <ExternalLink className="h-4 w-4" />
          Otevřít v novém okně
        </button>
        <button
          type="button"
          onClick={() => void downloadFile()}
          disabled={downloading}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {downloading ? "Stahuji…" : "Stáhnout prezentaci"}
        </button>
      </div>
    </div>
  );
}
