"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import {
  isMaketyListColumnDraggable,
  type MaketyListColumnId,
  type MaketyListColumnMeta,
} from "@/lib/makety/makety-list-columns";

type SortableHeaderCellProps = {
  column: MaketyListColumnMeta;
  canModuleAdmin: boolean;
};

function SortableHeaderCell({ column, canModuleAdmin }: SortableHeaderCellProps) {
  const draggable = isMaketyListColumnDraggable(column.id, canModuleAdmin);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    disabled: !draggable,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <th
      ref={setNodeRef}
      style={style}
      className="px-4 py-3 font-semibold text-gray-700"
    >
      <div className="flex items-center gap-1.5">
        {draggable ? (
          <button
            type="button"
            className="cursor-grab touch-none rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 active:cursor-grabbing"
            aria-label={`Přesunout sloupec ${column.label}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span className="w-5 shrink-0" aria-hidden />
        )}
        <span>{column.label}</span>
      </div>
    </th>
  );
}

type Props = {
  columns: MaketyListColumnMeta[];
  canModuleAdmin: boolean;
  onReorder: (activeId: MaketyListColumnId, overId: MaketyListColumnId) => void;
};

export function MaketyListSortableTableHead({ columns, canModuleAdmin, onReorder }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onReorder(active.id as MaketyListColumnId, over.id as MaketyListColumnId);
  };

  const sortableIds = columns
    .filter((c) => isMaketyListColumnDraggable(c.id, canModuleAdmin))
    .map((c) => c.id);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            {columns.map((col) => (
              <SortableHeaderCell key={col.id} column={col} canModuleAdmin={canModuleAdmin} />
            ))}
          </tr>
        </thead>
      </SortableContext>
    </DndContext>
  );
}
