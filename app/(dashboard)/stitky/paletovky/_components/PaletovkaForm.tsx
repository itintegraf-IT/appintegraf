"use client";

import { useState } from "react";
import {
  emptyBlock,
  type PaletovkaBlockData,
  type PaletovkaDocumentData,
  type PaletovkaLayoutVariant,
} from "@/lib/stitky/paletovky/types";
import { PaletovkaBlockForm } from "./PaletovkaBlockForm";
import { PaletovkaPreview } from "./PaletovkaPreview";

type Props = {
  layoutVariant: PaletovkaLayoutVariant;
  blocksPerPage: number;
  initial: PaletovkaDocumentData;
  onChange: (data: PaletovkaDocumentData) => void;
  readOnly?: boolean;
};

export function PaletovkaForm({
  layoutVariant,
  blocksPerPage,
  initial,
  onChange,
  readOnly = false,
}: Props) {
  const [data, setData] = useState<PaletovkaDocumentData>(initial);

  const update = (next: PaletovkaDocumentData) => {
    setData(next);
    onChange(next);
  };

  const updateBlock = (index: number, block: PaletovkaBlockData) => {
    const blocks = [...data.blocks];
    blocks[index] = block;
    update({ blocks });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className={`space-y-4 ${readOnly ? "hidden" : ""} print:hidden`}>
        {data.blocks.map((block, i) => (
          <PaletovkaBlockForm
            key={i}
            block={block}
            index={i}
            onUpdate={(b) => updateBlock(i, b)}
            readOnly={readOnly}
          />
        ))}
        {data.blocks.length < blocksPerPage && !readOnly && (
          <button
            type="button"
            className="text-sm text-red-700 hover:underline"
            onClick={() => update({ blocks: [...data.blocks, emptyBlock()] })}
          >
            + blok
          </button>
        )}
      </div>
      <div className="lg:col-span-1 print:col-span-full">
        <h3 className="mb-2 text-sm font-semibold text-gray-700 print:hidden">Náhled</h3>
        <PaletovkaPreview data={data} layoutVariant={layoutVariant} />
      </div>
    </div>
  );
}
