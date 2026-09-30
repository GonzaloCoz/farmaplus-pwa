"use client";

import {
  ArrowLeftToLine,
  ArrowRightToLine,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import UnfoldMoreIcon from "@hugeicons/core-free-icons/UnfoldMoreIcon";
import ChevronDownIcon from "@hugeicons/core-free-icons/ChevronDownIcon";
import ChevronUpIcon from "@hugeicons/core-free-icons/ChevronUpIcon";
import DragDropVerticalIcon from "@hugeicons/core-free-icons/DragDropVerticalIcon";
import { motion } from "motion/react";
import { type PointerEvent as ReactPointerEvent, useEffect } from "react";
import { createPortal } from "react-dom";
import { Checkbox } from "@/components/motion/checkbox";
import { EASE_OUT, SPRING_PRESS } from "@/lib/ease";
import { cn } from "@/lib/utils";
import { TableMenu } from "./table-menu";
import type {
  HeaderCellRefs,
  InsertPosition,
  SortState,
  TableColumn,
} from "./types";
import { alignFlex, alignText, COLUMN_ACTIVE_SHADOW } from "./utils";

export interface TableHeaderProps<T> {
  columns: TableColumn<T>[];
  rowHeight: number;
  reduce: boolean;
  thRefs: HeaderCellRefs;
  selectable: boolean;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
  sort: SortState | null;
  onToggleSort: (key: string) => void;
  resizable: boolean;
  onResizeStart: (key: string, e: ReactPointerEvent) => void;
  onResizeMove: (e: ReactPointerEvent) => void;
  onResizeEnd: (e: ReactPointerEvent) => void;
  reorderable: boolean;
  dragKey: string | null;
  dropIndex: number | null;
  onReorderStart: (key: string, e: ReactPointerEvent) => void;
  onReorderMove: (e: ReactPointerEvent) => void;
  onReorderEnd: (e: ReactPointerEvent) => void;
  onInsertColumn?: (index: number, position: InsertPosition) => void;
  onDeleteColumn?: (columnKey: string, index: number) => void;
  onColumnRename?: (columnKey: string, value: string) => void;
  activeColumn: string | null;
  onColumnActivate?: (key: string) => void;
  onColumnDeactivate?: () => void;
  dense?: boolean;
  headerClassName?: string;
}

/** Column insert / delete menu items shared by the header cell and the portal handle. */
function columnMenuItems<T>(
  column: TableColumn<T>,
  index: number,
  onInsertColumn?: (index: number, position: InsertPosition) => void,
  onDeleteColumn?: (columnKey: string, index: number) => void,
) {
  return [
    ...(onInsertColumn
      ? [
          {
            label: "Insertar antes",
            icon: <ArrowLeftToLine />,
            onSelect: () => onInsertColumn(index, "before"),
          },
          {
            label: "Insertar después",
            icon: <ArrowRightToLine />,
            onSelect: () => onInsertColumn(index, "after"),
          },
        ]
      : []),
    ...(onDeleteColumn
      ? [
          {
            label: "Eliminar columna",
            icon: <Trash2 />,
            destructive: true,
            onSelect: () => onDeleteColumn(column.key, index),
          },
        ]
      : []),
  ];
}

/** The ellipse handle, portaled so it can sit on the column's top border without
 * the scroll container clipping it. Straddles the border to bridge hover. */
function ColumnHandle<T>({
  column,
  index,
  thRefs,
  onInsertColumn,
  onDeleteColumn,
  onEnter,
  onLeave,
}: {
  column: TableColumn<T>;
  index: number;
  thRefs: HeaderCellRefs;
  onInsertColumn?: (index: number, position: InsertPosition) => void;
  onDeleteColumn?: (columnKey: string, index: number) => void;
  onEnter: () => void;
  onLeave: () => void;
}) {
  useEffect(() => {
    window.addEventListener("scroll", onLeave, true);
    return () => window.removeEventListener("scroll", onLeave, true);
  }, [onLeave]);

  const el = thRefs.current[column.key];
  if (!el || typeof document === "undefined") return null;
  const rect = el.getBoundingClientRect();

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: rect.top,
        left: rect.left + rect.width / 2,
        transform: "translate(-50%, -50%)",
        zIndex: 50,
      }}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
    >
      <TableMenu
        ariaLabel={`${column.key} column options`}
        triggerClassName="flex h-2 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        trigger={<MoreHorizontal className="h-3 w-3" />}
        items={columnMenuItems(column, index, onInsertColumn, onDeleteColumn)}
      />
    </div>,
    document.body,
  );
}

export function TableHeader<T>({
  columns,
  rowHeight,
  reduce,
  thRefs,
  selectable,
  allSelected,
  someSelected,
  onToggleAll,
  sort,
  onToggleSort,
  resizable,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
  reorderable,
  dragKey,
  dropIndex,
  onReorderStart,
  onReorderMove,
  onReorderEnd,
  onInsertColumn,
  onDeleteColumn,
  onColumnRename,
  activeColumn,
  onColumnActivate,
  onColumnDeactivate,
  dense = false,
  headerClassName,
}: TableHeaderProps<T>) {
  const hasColumnMenu = !!(onInsertColumn || onDeleteColumn);
  const activeIndex = columns.findIndex((c) => c.key === activeColumn);
  return (
    <>
      {hasColumnMenu && activeColumn && activeIndex >= 0 ? (
        <ColumnHandle
          column={columns[activeIndex]}
          index={activeIndex}
          thRefs={thRefs}
          onInsertColumn={onInsertColumn}
          onDeleteColumn={onDeleteColumn}
          onEnter={() => onColumnActivate?.(activeColumn)}
          onLeave={() => onColumnDeactivate?.()}
        />
      ) : null}
      <thead>
      <tr style={{ height: rowHeight }}>
        {selectable ? (
          <th className={cn("sticky top-0 z-40 border-border/60 border-b bg-white dark:bg-[#252525] dark:bg-surface-3", headerClassName)}>
            <div className="flex items-center justify-center">
              <Checkbox
                checked={allSelected}
                indeterminate={!allSelected && someSelected}
                onCheckedChange={onToggleAll}
                aria-label="Select all rows"
              />
            </div>
          </th>
        ) : null}
        {columns.map((column, index) => {
          const active = sort?.key === column.key;
          const isDragging = dragKey === column.key;
          const isActive = activeColumn === column.key;
          return (
            <th
              key={column.key}
              ref={(el) => {
                thRefs.current[column.key] = el;
              }}
              onPointerEnter={() => onColumnActivate?.(column.key)}
              onPointerLeave={() => onColumnDeactivate?.()}
              style={isActive ? { boxShadow: COLUMN_ACTIVE_SHADOW } : undefined}
              aria-sort={
                active
                  ? sort?.direction === "asc"
                    ? "ascending"
                    : "descending"
                  : undefined
              }
              data-drop={dragKey ? dropIndex === index : undefined}
              data-dropend={
                dragKey
                  ? dropIndex === columns.length && index === columns.length - 1
                  : undefined
              }
              className={cn(
                "group sticky top-0 z-40 border-border/40 border-b bg-white dark:bg-[#252525] dark:bg-surface-3 p-0 text-sm font-normal text-muted-foreground",
                headerClassName,
                "data-[drop=true]:before:absolute data-[drop=true]:before:inset-y-0 data-[drop=true]:before:left-0 data-[drop=true]:before:w-0.5 data-[drop=true]:before:bg-primary",
                "data-[dropend=true]:after:absolute data-[dropend=true]:after:inset-y-0 data-[dropend=true]:after:right-0 data-[dropend=true]:after:w-0.5 data-[dropend=true]:after:bg-primary",
              )}
            >
              <motion.div
                className={cn(
                  "flex h-full items-center justify-start",
                )}
                style={{ height: rowHeight }}
                animate={
                  reduce
                    ? { opacity: isDragging ? 0.5 : 1 }
                    : {
                        scale: isDragging ? 1.04 : 1,
                        opacity: isDragging ? 0.5 : 1,
                      }
                }
                transition={SPRING_PRESS}
              >
                {reorderable && column.key !== "select" ? (
                  <button
                    type="button"
                    aria-label={`Reorder ${column.key} column`}
                    onPointerDown={(e) => onReorderStart(column.key, e)}
                    onPointerMove={onReorderMove}
                    onPointerUp={onReorderEnd}
                    className={cn(
                      "flex h-full cursor-grab touch-none items-center text-muted-foreground/60 transition-colors hover:text-foreground active:cursor-grabbing",
                      dense ? "pl-1" : "pl-2"
                    )}
                  >
                    <HugeiconsIcon
                      icon={DragDropVerticalIcon as any}
                      size={dense ? 13 : 15}
                      strokeWidth={1.5}
                      className="shrink-0"
                    />
                  </button>
                ) : null}
                {column.sortable ? (
                  <button
                    type="button"
                    onClick={() => onToggleSort(column.key)}
                    className={cn(
                      "group/sort flex h-full min-w-0 flex-1 select-none items-center justify-start transition-colors hover:text-foreground text-sm font-normal",
                      dense ? "gap-1 pl-1.5" : "gap-1.5 pl-2.5",
                      index === columns.length - 1 ? (dense ? "pr-2" : "pr-6") : (dense ? "pr-1.5" : "pr-2.5"),
                      active && "text-foreground",
                    )}
                  >
                    <span className="truncate">{column.header}</span>
                    <span className="inline-flex shrink-0 items-center justify-center">
                      {active ? (
                        sort?.direction === "desc" ? (
                          <HugeiconsIcon
                            icon={ChevronDownIcon as any}
                            size={14}
                            strokeWidth={1.8}
                            className="text-foreground"
                          />
                        ) : (
                          <HugeiconsIcon
                            icon={ChevronUpIcon as any}
                            size={14}
                            strokeWidth={1.8}
                            className="text-foreground"
                          />
                        )
                      ) : (
                        <HugeiconsIcon
                          icon={UnfoldMoreIcon as any}
                          size={14}
                          strokeWidth={1.5}
                          className="text-muted-foreground/40 group-hover/sort:text-muted-foreground transition-colors"
                        />
                      )}
                    </span>
                  </button>
                ) : onColumnRename ? (
                  <input
                    value={
                      typeof column.header === "string" ? column.header : ""
                    }
                    aria-label={`Rename ${column.key} column`}
                    size={1}
                    onChange={(e) =>
                      onColumnRename(column.key, e.target.value)
                    }
                    className={cn(
                      "min-w-0 flex-1 truncate appearance-none rounded-md border-0 bg-transparent pl-2.5 font-normal text-sm text-muted-foreground outline-none transition-colors focus:bg-muted focus:text-foreground text-left",
                      index === columns.length - 1 ? "pr-6" : "pr-2.5",
                    )}
                  />
                ) : (
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm font-normal",
                      column.key === "select"
                        ? "flex items-center justify-center p-0"
                        : cn("text-left pl-2.5", index === columns.length - 1 ? "pr-6" : "pr-2.5"),
                    )}
                  >
                    {column.header}
                  </span>
                )}
              </motion.div>
              {resizable && column.key !== "select" ? (
                <button
                  type="button"
                  aria-label={`Resize ${column.key} column`}
                  tabIndex={-1}
                  onPointerDown={(e) => onResizeStart(column.key, e)}
                  onPointerMove={onResizeMove}
                  onPointerUp={onResizeEnd}
                  className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize touch-none bg-transparent transition-colors hover:bg-primary/40"
                />
              ) : null}
            </th>
          );
        })}
      </tr>
    </thead>
    </>
  );
}
