"use client";

import { cn } from "@/lib/utils";
import { useLegendItem } from "./legend-context";

export interface LegendValueProps {
  /** Value class name */
  className?: string;
  /** Suffix to append, e.g. "%" */
  suffix?: string;
  /** Format function for value */
  formatValue?: (value: number) => string;
}

export function LegendValue({
  className = "text-xs font-semibold tabular-nums text-muted-foreground ml-auto",
  suffix = "%",
  formatValue,
}: LegendValueProps) {
  const { item } = useLegendItem();

  const formatted = formatValue ? formatValue(item.value) : `${item.value}${suffix}`;

  return (
    <span className={cn("text-xs tabular-nums font-medium text-foreground/80", className)}>
      {formatted}
    </span>
  );
}

LegendValue.displayName = "LegendValue";
export default LegendValue;
