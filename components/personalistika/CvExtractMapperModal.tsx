"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { GripVertical, X } from "lucide-react";
import type { ExtractedCvDraft } from "@/lib/personalistika/llm-extract-cv-draft";
import {
  type CvExtractFieldItem,
  type CvFormFieldKey,
  type CvFormFieldMeta,
  groupCvFormFields,
} from "@/lib/personalistika/cv-field-registry";

export type CvExtractApiResult = {
  extracted: ExtractedCvDraft;
  fields: CvExtractFieldItem[];
  sourceText: string;
  sourceTextTruncated?: boolean;
  meta?: {
    pageCount?: number;
    textLength?: number;
    provider?: string;
    model?: string;
    usedFallback?: boolean;
  };
};

type Props = {
  open: boolean;
  pdfFile: File;
  result: CvExtractApiResult;
  onClose: () => void;
  onApplyMappings: (mappings: Partial<Record<CvFormFieldKey, string>>) => void;
  onApplyAllAutomatic: (extracted: ExtractedCvDraft) => void;
};

type MappingEntry = { value: string; chipId: string; chipLabel: string };

function initPoolAndMappings(fields: CvExtractFieldItem[]) {
  const mappings: Partial<Record<CvFormFieldKey, MappingEntry>> = {};
  const pool: CvExtractFieldItem[] = [];

  for (const item of fields) {
    const target = item.suggestedFormField;
    if (target && !mappings[target]) {
      mappings[target] = { value: item.value, chipId: item.id, chipLabel: item.label };
    } else {
      pool.push(item);
    }
  }

  return { mappings, pool };
}

function ChipBody({ item }: { item: CvExtractFieldItem }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="font-medium text-gray-800">{item.label}</div>
      <div className="mt-0.5 line-clamp-2 text-gray-600">{item.value}</div>
    </div>
  );
}

function DraggableChip({
  item,
  selected,
  onSelect,
}: {
  item: CvExtractFieldItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `chip:${item.id}`,
    data: { type: "chip", item },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className={`flex cursor-grab items-start gap-2 rounded-lg border px-3 py-2 text-sm active:cursor-grabbing ${
        selected
          ? "border-red-400 bg-red-50 ring-2 ring-red-200"
          : "border-gray-200 bg-white hover:border-gray-300"
      } ${isDragging ? "opacity-40" : ""}`}
    >
      <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
      <ChipBody item={item} />
    </div>
  );
}

function FormDropZone({
  fieldKey,
  label,
  mapped,
  selectedChipId,
  onClear,
  onClickAssign,
}: {
  fieldKey: CvFormFieldKey;
  label: string;
  mapped: MappingEntry | undefined;
  selectedChipId: string | null;
  onClear: () => void;
  onClickAssign: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `formField:${fieldKey}`,
    data: { type: "formField", fieldKey },
  });

  return (
    <div
      ref={setNodeRef}
      onClick={onClickAssign}
      className={`rounded-lg border-2 border-dashed px-3 py-2 text-sm transition-colors ${
        isOver
          ? "border-red-400 bg-red-50"
          : selectedChipId
            ? "cursor-pointer border-amber-400 bg-amber-50/50"
            : mapped
              ? "border-green-300 bg-green-50/50"
              : "border-gray-200 bg-gray-50/80"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-gray-700">{label}</span>
        {mapped && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="rounded p-0.5 text-gray-500 hover:bg-gray-200 hover:text-gray-800"
            title="Odebrat mapování"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {mapped ? (
        <p className="mt-1 line-clamp-3 text-gray-800">{mapped.value}</p>
      ) : (
        <p className="mt-1 text-xs text-gray-500">
          {selectedChipId ? "Klikněte pro přiřazení" : "Přetáhněte sem hodnotu"}
        </p>
      )}
    </div>
  );
}

function PoolSection({
  pool,
  selectedChipId,
  onSelectChip,
}: {
  pool: CvExtractFieldItem[];
  selectedChipId: string | null;
  onSelectChip: (id: string) => void;
}) {
  return (
    <div className="max-h-[28vh] shrink-0 overflow-y-auto border-b border-gray-100 bg-gray-50/80 p-3 lg:max-h-[35%]">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
        Nepřiřazené hodnoty ({pool.length})
      </p>
      {pool.length === 0 ? (
        <p className="text-sm text-gray-500">Všechny hodnoty jsou namapované.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {pool.map((item) => (
            <DraggableChip
              key={item.id}
              item={item}
              selected={selectedChipId === item.id}
              onSelect={() => onSelectChip(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FieldGroup({
  group,
  fields,
  mappings,
  selectedChipId,
  onClear,
  onClickAssign,
}: {
  group: string;
  fields: CvFormFieldMeta[];
  mappings: Partial<Record<CvFormFieldKey, MappingEntry>>;
  selectedChipId: string | null;
  onClear: (key: CvFormFieldKey) => void;
  onClickAssign: (key: CvFormFieldKey) => void;
}) {
  return (
    <div className="mb-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{group}</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {fields.map((f) => (
          <FormDropZone
            key={f.key}
            fieldKey={f.key}
            label={f.label}
            mapped={mappings[f.key]}
            selectedChipId={selectedChipId}
            onClear={() => onClear(f.key)}
            onClickAssign={() => onClickAssign(f.key)}
          />
        ))}
      </div>
    </div>
  );
}

function SourceTextPanel({ sourceText, truncated }: { sourceText: string; truncated?: boolean }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      {truncated && (
        <p className="mb-2 text-xs text-amber-700">Text byl zkrácen pro zobrazení v prohlížeči.</p>
      )}
      <pre className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs leading-relaxed text-gray-800">
        {sourceText}
      </pre>
    </div>
  );
}

export function CvExtractMapperModal({
  open,
  pdfFile,
  result,
  onClose,
  onApplyMappings,
  onApplyAllAutomatic,
}: Props) {
  const [rightTab, setRightTab] = useState<"fields" | "text">("fields");
  const [mappings, setMappings] = useState<Partial<Record<CvFormFieldKey, MappingEntry>>>({});
  const [pool, setPool] = useState<CvExtractFieldItem[]>([]);
  const [selectedChipId, setSelectedChipId] = useState<string | null>(null);
  const [activeChip, setActiveChip] = useState<CvExtractFieldItem | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const groupedFields = useMemo(() => groupCvFormFields(), []);

  useEffect(() => {
    if (!open) return;
    const { mappings: m, pool: p } = initPoolAndMappings(result.fields);
    setMappings(m);
    setPool(p);
    setSelectedChipId(null);
    setRightTab("fields");
  }, [open, result.fields]);

  useEffect(() => {
    if (!open || !pdfFile) {
      setPdfUrl(null);
      return;
    }
    const url = URL.createObjectURL(pdfFile);
    setPdfUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [open, pdfFile]);

  const findChipById = useCallback(
    (chipId: string) => pool.find((c) => c.id === chipId) ?? result.fields.find((f) => f.id === chipId) ?? null,
    [pool, result.fields]
  );

  const assignChipToField = useCallback(
    (chip: CvExtractFieldItem, fieldKey: CvFormFieldKey) => {
      setMappings((prev) => {
        const next = { ...prev };
        const displaced = next[fieldKey];
        if (displaced && displaced.chipId !== chip.id) {
          const oldChip = result.fields.find((f) => f.id === displaced.chipId);
          if (oldChip) {
            setPool((p) => {
              const filtered = p.filter((c) => c.id !== chip.id && c.id !== oldChip.id);
              return [...filtered, oldChip];
            });
          }
        }
        next[fieldKey] = { value: chip.value, chipId: chip.id, chipLabel: chip.label };
        return next;
      });
      setPool((p) => p.filter((c) => c.id !== chip.id));
      setSelectedChipId(null);
    },
    [result.fields]
  );

  const clearField = useCallback(
    (fieldKey: CvFormFieldKey) => {
      setMappings((prev) => {
        const entry = prev[fieldKey];
        if (!entry) return prev;
        const chip = result.fields.find((f) => f.id === entry.chipId);
        if (chip) setPool((p) => (p.some((c) => c.id === chip.id) ? p : [...p, chip]));
        const next = { ...prev };
        delete next[fieldKey];
        return next;
      });
    },
    [result.fields]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type === "chip") setActiveChip(data.item as CvExtractFieldItem);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveChip(null);
    const { active, over } = event;
    if (!over) return;
    const activeData = active.data.current;
    const overData = over.data.current;
    if (activeData?.type === "chip" && overData?.type === "formField") {
      assignChipToField(activeData.item as CvExtractFieldItem, overData.fieldKey as CvFormFieldKey);
    }
  };

  const handleDropZoneClick = (fieldKey: CvFormFieldKey) => {
    if (!selectedChipId) return;
    const chip = findChipById(selectedChipId);
    if (chip) assignChipToField(chip, fieldKey);
  };

  const handleApplyMappings = () => {
    const flat: Partial<Record<CvFormFieldKey, string>> = {};
    for (const key of Object.keys(mappings) as CvFormFieldKey[]) {
      const entry = mappings[key];
      if (entry?.value) flat[key] = entry.value;
    }
    onApplyMappings(flat);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Ruční mapování CV</h2>
          <p className="text-sm text-gray-600">
            {pdfFile.name}
            {result.meta?.model ? ` · ${result.meta.provider ?? "AI"} / ${result.meta.model}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
          aria-label="Zavřít"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <PdfPane pdfUrl={pdfUrl} />

          <div className="flex min-h-0 flex-1 flex-col lg:w-[55%]">
            <div className="flex border-b border-gray-200">
              <button
                type="button"
                onClick={() => setRightTab("fields")}
                className={`px-4 py-2 text-sm font-medium ${
                  rightTab === "fields"
                    ? "border-b-2 border-red-600 text-red-700"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Vytěžená pole ({result.fields.length})
              </button>
              <button
                type="button"
                onClick={() => setRightTab("text")}
                className={`px-4 py-2 text-sm font-medium ${
                  rightTab === "text"
                    ? "border-b-2 border-red-600 text-red-700"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Text z PDF
              </button>
            </div>

            {rightTab === "fields" ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <PoolSection
                  pool={pool}
                  selectedChipId={selectedChipId}
                  onSelectChip={(id) => setSelectedChipId((prev) => (prev === id ? null : id))}
                />
                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  <p className="mb-2 text-xs text-gray-500">
                    Přetáhněte hodnotu na pole formuláře, nebo vyberte chip a klikněte na cíl.
                  </p>
                  {Array.from(groupedFields.entries()).map(([group, fields]) => (
                    <FieldGroup
                      key={group}
                      group={group}
                      fields={fields}
                      mappings={mappings}
                      selectedChipId={selectedChipId}
                      onClear={clearField}
                      onClickAssign={handleDropZoneClick}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <SourceTextPanel sourceText={result.sourceText} truncated={result.sourceTextTruncated} />
            )}
          </div>
        </div>

        <DragOverlay>
          {activeChip ? (
            <div className="flex max-w-xs items-start gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm shadow-lg">
              <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <ChipBody item={activeChip} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Zrušit
        </button>
        <button
          type="button"
          onClick={() => {
            onApplyAllAutomatic(result.extracted);
            onClose();
          }}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          Automaticky doplnit vše
        </button>
        <button
          type="button"
          onClick={handleApplyMappings}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Použít namapovaná pole
        </button>
      </footer>
    </div>
  );
}

function PdfPane({ pdfUrl }: { pdfUrl: string | null }) {
  return (
    <div className="flex min-h-[240px] flex-1 flex-col border-b border-gray-200 lg:min-h-0 lg:w-[45%] lg:border-b-0 lg:border-r">
      <div className="border-b border-gray-100 px-3 py-2 text-sm font-medium text-gray-700">Náhled PDF</div>
      <div className="min-h-0 flex-1 bg-gray-100 p-2">
        {pdfUrl ? (
          <iframe
            src={pdfUrl}
            title="Náhled CV"
            className="h-full min-h-[220px] w-full rounded border border-gray-200 bg-white lg:min-h-[calc(100vh-12rem)]"
          />
        ) : (
          <p className="p-4 text-sm text-gray-500">Načítání náhledu…</p>
        )}
      </div>
    </div>
  );
}
