"use client";

import { useCallback, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";

type Props = {
  src: string;
  title: string;
};

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

export function VykresyImagePreview({ src, title }: Props) {
  const [zoom, setZoom] = useState(1);

  const setClamped = useCallback((next: number) => {
    setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(next * 100) / 100)));
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setClamped(zoom - ZOOM_STEP)}
          disabled={zoom <= MIN_ZOOM}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          title="Zmenšit"
        >
          <Minus className="h-3.5 w-3.5" />
          Zmenšit
        </button>
        <span className="min-w-[3.5rem] text-center text-xs font-medium text-gray-600">
          {Math.round(zoom * 100)} %
        </span>
        <button
          type="button"
          onClick={() => setClamped(zoom + ZOOM_STEP)}
          disabled={zoom >= MAX_ZOOM}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          title="Zvětšit"
        >
          <Plus className="h-3.5 w-3.5" />
          Zvětšit
        </button>
        <button
          type="button"
          onClick={() => setZoom(1)}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
          title="Obnovit velikost"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
      </div>
      <div
        className="max-h-[min(78vh,720px)] overflow-auto rounded-lg border border-gray-200 bg-white p-2"
        onWheel={(e) => {
          if (!e.ctrlKey && !e.metaKey) return;
          e.preventDefault();
          setClamped(zoom + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
        }}
      >
        <div className="flex min-h-[200px] items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={title}
            draggable={false}
            className="max-w-none origin-center transition-transform duration-100"
            style={{
              transform: `scale(${zoom})`,
              maxHeight: zoom === 1 ? "min(70vh, 640px)" : undefined,
              width: zoom === 1 ? "auto" : undefined,
              maxWidth: zoom === 1 ? "100%" : undefined,
            }}
          />
        </div>
      </div>
      <p className="text-center text-xs text-gray-500">
        Ctrl + kolečko myši také mění velikost
      </p>
    </div>
  );
}
