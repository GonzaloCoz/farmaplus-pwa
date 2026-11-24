"use client";

// Backward compatibility bridge: re-exports useFluidHover as useProximityHover
import {
  useFluidHover,
  useRegisterFluidHoverItem,
  type ItemRect,
  type UseFluidHoverOptions,
  type UseFluidHoverReturn,
} from "@/hooks/use-fluid-hover";

export const useProximityHover = useFluidHover;
export { useFluidHover, useRegisterFluidHoverItem };
export type { ItemRect, UseFluidHoverOptions, UseFluidHoverReturn };
export type UseProximityHoverOptions = UseFluidHoverOptions;
export type UseProximityHoverReturn = UseFluidHoverReturn;
