"use client";

type Props = {
  data: string;
  alt?: string;
  className?: string;
};

export function BarcodeImage({ data, alt = "CODE128", className }: Props) {
  if (!data) return null;
  const src = `/api/stitky/barcode?text=${encodeURIComponent(data)}`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className ?? "h-10 max-w-full object-contain"} loading="lazy" />
  );
}
