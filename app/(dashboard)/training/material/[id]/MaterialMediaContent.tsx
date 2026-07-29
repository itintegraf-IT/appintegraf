"use client";

import Link from "next/link";
import { Download, ExternalLink } from "lucide-react";
import { parseMaterialType } from "@/lib/training/material-types";
import type { MaterialFileMeta } from "@/lib/training/material-api";
import { getMaterialFileServeUrl } from "@/lib/training/material-api";
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
    return (
      <video controls className="w-full rounded-lg bg-black" preload="metadata">
        <source src={src} type={file.mime_type || "video/mp4"} />
        Váš prohlížeč nepodporuje přehrávání videa.
      </video>
    );
  }

  if (mediaUrl) {
    const embed = resolveVideoEmbed(mediaUrl);
    if (embed?.kind === "iframe") {
      return (
        <div className="aspect-video overflow-hidden rounded-lg bg-black">
          <iframe
            src={embed.embedUrl}
            title="Video"
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }
    if (embed?.kind === "video") {
      return (
        <video controls className="w-full rounded-lg bg-black" src={embed.src}>
          Váš prohlížeč nepodporuje přehrávání videa.
        </video>
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
  if (!file) {
    return <p className="text-gray-500">Prezentace není k dispozici.</p>;
  }

  const src = file.serve_url || getMaterialFileServeUrl(materialId);
  const isPdf = file.mime_type === "application/pdf" || file.file_path.toLowerCase().endsWith(".pdf");

  if (isPdf) {
    return (
      <iframe
        src={src}
        title={file.original_filename}
        className="h-[70vh] w-full rounded-lg border border-gray-200"
      />
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
      <p className="mb-4 text-gray-700">
        Prezentace <strong>{file.original_filename}</strong> je k dispozici ke stažení.
      </p>
      <Link
        href={src}
        download={file.original_filename}
        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
      >
        <Download className="h-4 w-4" />
        Stáhnout prezentaci
      </Link>
    </div>
  );
}
