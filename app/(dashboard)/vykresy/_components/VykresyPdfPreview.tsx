"use client";

type Props = {
  src: string;
  title: string;
};

export function VykresyPdfPreview({ src, title }: Props) {
  return (
    <iframe
      title={`Náhled: ${title}`}
      src={`${src}#view=FitH`}
      className="h-[min(78vh,720px)] w-full rounded-lg border border-gray-200 bg-white"
    />
  );
}
