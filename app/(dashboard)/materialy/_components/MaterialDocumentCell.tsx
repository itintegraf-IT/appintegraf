"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Eye, FileText, X } from "lucide-react";
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
  const [mounted, setMounted] = useState(false);
  const showDate = dateLabel && dateLabel !== EM_DASH;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!previewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [previewOpen]);

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

  const previewModal =
    mounted && previewOpen && canPreview
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="material-doc-preview-title"
            onClick={() => setPreviewOpen(false)}
          >
            <div
              className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 px-4 py-3">
                <div className="min-w-0">
                  <h2
                    id="material-doc-preview-title"
                    className="truncate text-sm font-semibold text-gray-900"
                  >
                    {file.original_filename}
                  </h2>
                  {dateLabel && dateLabel !== EM_DASH ? (
                    <p className="mt-0.5 text-xs text-gray-500">Platnost: {dateLabel}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href={file.file_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-red-600 hover:bg-gray-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    St�hnout
                  </a>
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(false)}
                    className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                    title="Zav?�t (Esc)"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto bg-gray-100 p-3 sm:p-4">
                {isPdf ? (
                  <iframe
                    title={`N�hled: ${file.original_filename}`}
                    src={`${file.file_path}#view=FitH`}
                    className="h-[min(78vh,720px)] w-full rounded-lg border border-gray-200 bg-white"
                  />
                ) : (
                  <img
                    src={file.file_path}
                    alt={file.original_filename}
                    className="mx-auto max-h-[min(78vh,720px)] w-auto max-w-full rounded-lg object-contain shadow-sm"
                  />
                )}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
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
            title="St�hnout / otev?�t"
          >
            <Download className="h-3.5 w-3.5" />
            St�hnout
          </a>
          {canPreview ? (
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="inline-flex items-center gap-0.5 text-gray-600 hover:text-red-700"
              title="Zobrazit n�hled v okn?"
            >
              <Eye className="h-3.5 w-3.5" />
              N�hled
            </button>
          ) : null}
        </div>
      </div>
      {previewModal}
    </>
  );
}
