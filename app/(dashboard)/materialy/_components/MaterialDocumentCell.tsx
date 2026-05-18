"use client";

import { useState } from "react";
import { Download, Eye, EyeOff, FileText } from "lucide-react";
import type { MaterialFileSummary } from "@/lib/materialy/material-files";

function isPdfMime(mime: string) {
  return mime.trim().toLowerCase() === "application/pdf";
}

function isImageMime(mime: string) {
  return mime.trim().toLowerCase().startsWith("image/");
}

const EM_DASH = "\u2014";

type Props = {
  file: MaterialFileSummary | null | undefined;
  dateLabel?: string;
};

export function MaterialDocumentCell({ file, dateLabel }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const showDate = dateLabel && dateLabel !== EM_DASH;

  if (!file) {
    return (
      <div className="text-gray-600">
        {showDate ? <div>{dateLabel}</div> : <span className="text-gray-400">{EM_DASH}</span>}
      </div>
    );
  }

  const isPdf = isPdfMime(file.mime_type);
  const isImage = isImageMime(file.mime_type);
  const canPreview = isPdf || isImage;

  return (
    <div className="min-w-[8rem] max-w-[14rem] space-y-1">
      {showDate ? <div className="text-gray-600">{dateLabel}</div> : null}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
        <span className="inline-flex min-w-0 items-center gap-1 text-gray-700" title={file.original_filename}>
          <FileText className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span className="max-w-[7rem] truncate">{file.original_filename}</span>
        </span>
        <a
          href={file.file_path}
          target="_blank"
          rel="noopener noreferrer"
          download
          className="inline-flex items-center gap-0.5 text-red-600 hover:underline"
          title="St\u00e1hnout / otev\u0159\u00edt"
        >
          <Download className="h-3.5 w-3.5" />
          {"St\u00e1hnout"}
        </a>
        {canPreview ? (
          <button
            type="button"
            onClick={() => setPreviewOpen((v) => !v)}
            className="inline-flex items-center gap-0.5 text-gray-600 hover:text-red-700"
            title={previewOpen ? "Skr\u00fdt n\u00e1hled" : "Zobrazit n\u00e1hled"}
          >
            {previewOpen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {previewOpen ? "Skr\u00fdt" : "N\u00e1hled"}
          </button>
        ) : null}
      </div>
      {previewOpen && canPreview ? (
        <div className="mt-1 rounded-md border border-gray-200 bg-gray-50 p-1">
          {isPdf ? (
            <iframe
              title={`N\u00e1hled: ${file.original_filename}`}
              src={`${file.file_path}#view=FitH`}
              className="h-40 w-full min-w-[10rem] rounded border border-gray-200 bg-white"
            />
          ) : (
            <img
              src={file.file_path}
              alt={file.original_filename}
              className="mx-auto max-h-32 max-w-full rounded object-contain"
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
