"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useLegend, useLegendItem } from "./legend-context";

export interface LegendItemProps {
  /** Container class name */
  className?: string;
  /** Children components (LegendMarker, LegendLabel, LegendValue, LegendProgress) */
  children: ReactNode;
}

export function LegendItem({ className = "", children }: LegendItemProps) {
  const { setHoveredIndex } = useLegend();
  const { index, isHovered } = useLegendItem();

  return (
    <div
      className={cn(
        "cursor-pointer rounded-lg px-2.5 py-1.5 transition-all duration-150 ease-out flex items-center justify-between gap-3 text-xs",
        isHovered && "bg-muted/70 dark:bg-surface-2",
        className
      )}
      data-hovered={isHovered ? "" : undefined}
      onMouseEnter={() => setHoveredIndex(index)}
      onMouseLeave={() => setHoveredIndex(null)}
    >
      {children}
    </div>
  );
}

LegendItem.displayName = "LegendItem";

export const LegendItemComponent = LegendItem;
export default LegendItem;
