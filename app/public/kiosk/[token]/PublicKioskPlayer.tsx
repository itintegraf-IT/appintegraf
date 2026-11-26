"use client";

import { useCallback, useEffect, useState } from "react";

type Slide = {
  id: number;
  url: string;
  file_type: string;
  title: string | null;
  filename: string;
  duration: number | null;
  transition_effect: string | null;
};

type PresentationPayload = {
  name: string;
  transition_effect: string;
  transition_time: number;
  display_duration: number;
  slides: Slide[];
};

export function PublicKioskPlayer({ token }: { token: string }) {
  const [data, setData] = useState<PresentationPayload | null>(null);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/kiosk/${encodeURIComponent(token)}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Prezentace nenalezena");
        setData(null);
        return;
      }
      setError("");
      setData(json as PresentationPayload);
      setIndex((i) => {
        const len = (json as PresentationPayload).slides?.length ?? 0;
        if (len === 0) return 0;
        return i % len;
      });
    } catch {
      setError("Chyba při načítání prezentace");
    }
  }, [token]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 60_000);
    return () => clearInterval(poll);
  }, [load]);

  useEffect(() => {
    if (!data?.slides?.length) return;
    const slide = data.slides[index];
    const seconds = slide?.duration ?? data.display_duration ?? 10;
    const ms = Math.max(1, seconds) * 1000;
    const t = setTimeout(() => {
      setIndex((i) => (i + 1) % data.slides.length);
    }, ms);
    return () => clearTimeout(t);
  }, [data, index]);

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black p-8 text-center">
        <p className="text-lg text-gray-300">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black">
        <p className="text-gray-400">Načítání…</p>
      </div>
    );
  }

  if (data.slides.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black p-8 text-center">
        <p className="text-lg text-gray-300">Prezentace nemá žádné snímky</p>
      </div>
    );
  }

  const effect = data.transition_effect || "fade";

  return (
    <div className="relative h-full w-full bg-black">
      {data.slides.map((slide, i) => {
        const active = i === index;
        return (
          <div
            key={slide.id}
            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-1000 ease-in-out ${
              active ? "z-[1] opacity-100" : "pointer-events-none z-0 opacity-0"
            }`}
            aria-hidden={!active}
            data-effect={effect}
          >
            {slide.file_type === "pdf" ? (
              <iframe
                title={slide.title ?? slide.filename}
                src={`${slide.url}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
                className="h-full w-full border-0 bg-black"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={slide.url}
                alt={slide.title ?? slide.filename}
                className="max-h-full max-w-full object-contain"
                draggable={false}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
