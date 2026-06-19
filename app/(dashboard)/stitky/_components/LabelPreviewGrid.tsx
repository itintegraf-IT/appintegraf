"use client";

import { getGridSpec, labelPositionMm } from "@/lib/stitky/label-layout";
import { type LabelCell } from "@/lib/stitky/ciselna-rada";
import { BarcodeImage } from "./BarcodeImage";

type Props = {
  templateKey: string;
  componentKey: string;
  pages: LabelCell[][];
};

function StandardLabel({ cell }: { cell: LabelCell }) {
  return (
    <>
      <div className="font-medium leading-tight">{cell.text1}</div>
      <div className="leading-tight">{cell.text2}</div>
      {cell.text3 ? <div className="leading-tight">{cell.text3}</div> : null}
      {cell.rangeLabel ? <div className="text-[8pt] text-gray-600">{cell.rangeLabel}</div> : null}
      <div className="mt-auto flex justify-between text-[8pt]">
        <span>Počet: {cell.pocetKs}</span>
        <span>{cell.zakazka}</span>
      </div>
    </>
  );
}

function NeutLabel({ cell }: { cell: LabelCell }) {
  return (
    <>
      <div className="leading-tight">{cell.text1}</div>
      <div className="leading-tight">{cell.text2}</div>
      {cell.text3 ? <div className="leading-tight">{cell.text3}</div> : null}
      {cell.rangeLabel ? <div className="text-[8pt] text-gray-600">{cell.rangeLabel}</div> : null}
      <div className="mt-auto flex justify-between text-[8pt]">
        <span>{cell.pocetKs}</span>
        <span>{cell.zakazka}</span>
      </div>
    </>
  );
}

function OriflameLabel({ cell }: { cell: LabelCell }) {
  return (
    <>
      <div className="text-[8pt] font-semibold">{cell.oriflameHeader}</div>
      <div className="font-medium leading-tight">{cell.text1}</div>
      <div className="text-[8pt] leading-tight">{cell.text2}</div>
      <div className="flex gap-2 text-[8pt]">
        <span>{cell.totalUnitsLabel}</span>
        <span className="font-medium">{cell.totalUnitsValue}</span>
        <span>{cell.totalUnitsPcs}</span>
      </div>
      <div className="mt-auto pt-1">
        {cell.barcodeData ? <BarcodeImage data={cell.barcodeData} /> : null}
      </div>
    </>
  );
}

function LabelCellView({ cell, componentKey }: { cell: LabelCell; componentKey: string }) {
  const inner =
    componentKey === "oriflame" ? (
      <OriflameLabel cell={cell} />
    ) : componentKey === "neut" ? (
      <NeutLabel cell={cell} />
    ) : (
      <StandardLabel cell={cell} />
    );

  return (
    <div className="stitky-label-box flex flex-col overflow-hidden border border-gray-300 p-1.5 text-[9pt] leading-snug">
      {inner}
    </div>
  );
}

export function LabelPreviewGrid({ templateKey, componentKey, pages }: Props) {
  const spec = getGridSpec(componentKey);

  return (
    <div className="stitky-preview-root space-y-6">
      <p className="stitky-no-print text-sm text-gray-600">
        Šablona: <strong>{templateKey}</strong> — {pages.length}{" "}
        {pages.length === 1 ? "strana" : pages.length < 5 ? "strany" : "stran"}
      </p>

      {pages.map((pageCells, pageIndex) => (
        <div
          key={pageIndex}
          className="stitky-print-page relative mx-auto bg-white shadow-sm print:shadow-none"
          style={{
            width: `${210}mm`,
            height: `${297}mm`,
            pageBreakAfter: pageIndex < pages.length - 1 ? "always" : "auto",
          }}
        >
          {pageCells.map((cell, cellIndex) => {
            const pos = labelPositionMm(cellIndex, spec);
            return (
              <div
                key={cellIndex}
                className="absolute"
                style={{
                  left: `${pos.x}mm`,
                  top: `${pos.y}mm`,
                  width: `${spec.labelWidthMm}mm`,
                  height: `${spec.labelHeightMm}mm`,
                }}
              >
                <LabelCellView cell={cell} componentKey={componentKey} />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
