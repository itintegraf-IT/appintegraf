import type { PaletovkaBlockData, PaletovkaDocumentData, PaletovkaLayoutVariant } from "@/lib/stitky/paletovky/types";

type Props = {
  data: PaletovkaDocumentData;
  layoutVariant: PaletovkaLayoutVariant;
};

function BlockView({ block }: { block: PaletovkaBlockData }) {
  return (
    <div className="paletovka-block border border-black p-3 text-sm">
      <div className="grid grid-cols-[5rem_1fr] gap-y-1">
        <span className="font-semibold">ZADAVATEL</span>
        <span>{block.zadavatel}</span>
        <span className="font-semibold">ZAKÁZKA</span>
        <span>{block.zakazka}</span>
        <span className="font-semibold">č.z.</span>
        <span>{block.cisloZakazky}</span>
        {block.druh && (
          <>
            <span className="font-semibold">Druh:</span>
            <span>{block.druh}</span>
          </>
        )}
        {block.urcenoPro && (
          <>
            <span className="font-semibold">Určeno pro:</span>
            <span>{block.urcenoPro}</span>
          </>
        )}
        {(block.extraLines ?? []).map((line, i) => (
          <span key={i} className="col-span-2 pl-0">
            {line}
          </span>
        ))}
        <span className="font-semibold">{block.nakladLabel}</span>
        <span className="flex justify-between gap-2">
          <span>{block.baleniPopis}</span>
          <span className="font-semibold">{block.jednotkaLabel}</span>
        </span>
      </div>
      <div className="mt-2 space-y-1 border-t border-gray-300 pt-2">
        {block.radky.map((row, i) => (
          <div key={i} className="grid grid-cols-[6rem_1fr_3rem] gap-2">
            <span className="font-semibold">{row.mnozstvi}</span>
            <span>{row.popis}</span>
            <span className="text-right">{row.cislo}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PaletovkaPreview({ data, layoutVariant }: Props) {
  const gridClass =
    layoutVariant === "dual_horizontal"
      ? "grid grid-cols-1 gap-4 md:grid-cols-2"
      : layoutVariant === "stacked"
        ? "flex flex-col gap-6"
        : "max-w-xl";

  return (
    <div className={`paletovka-preview ${gridClass}`}>
      {data.blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </div>
  );
}
