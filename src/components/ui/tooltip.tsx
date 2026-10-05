"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { motion, useMotionValue } from "framer-motion";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/springs";
import { fontWeights } from "@/lib/font-weight";
import { useShape } from "@/lib/shape-context";

// ---------------------------------------------------------------------------
// Portal container context
// ---------------------------------------------------------------------------

const TooltipPortalContainerContext = createContext<HTMLElement | null>(null);

function TooltipPortalContainer({
  value,
  children,
}: {
  value: HTMLElement | null;
  children: ReactNode;
}) {
  return (
    <TooltipPortalContainerContext.Provider value={value}>
      {children}
    </TooltipPortalContainerContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const DEFAULT_DELAY = 200;

// Tracks whether an app-level <TooltipProvider> is above us. Each Tooltip
// only wraps itself in a local primitive Provider when there isn't one —
// a per-instance Provider would defeat cross-tooltip skip-delay grouping
// (moving between adjacent tooltips would re-wait the full delay).
const TooltipGroupContext = createContext(false);

interface TooltipProviderProps {
  children: ReactNode;
  /** Hover delay before tooltips open, in ms. Defaults to 200. */
  delayDuration?: number;
  /** After a tooltip closes, adjacent tooltips opened within this window
   *  skip the hover delay, in ms. Defaults to 300. */
  skipDelayDuration?: number;
}

/** Groups descendant Tooltips so that once one opens, moving to an adjacent
 *  trigger shows its tooltip instantly instead of re-waiting the full delay.
 *  Wrap once at the app (or section) level; bare Tooltips still work without
 *  it via a per-instance fallback. */
function TooltipProvider({
  children,
  delayDuration = DEFAULT_DELAY,
  skipDelayDuration = 300,
}: TooltipProviderProps) {
  return (
    <TooltipGroupContext.Provider value={true}>
      <TooltipPrimitive.Provider
        delay={delayDuration}
        timeout={skipDelayDuration}
      >
        {children}
      </TooltipPrimitive.Provider>
    </TooltipGroupContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TooltipSide = "top" | "right" | "bottom" | "left";

interface TooltipProps {
  content?: ReactNode;
  children: React.ReactElement | ReactNode;
  side?: TooltipSide;
  sideOffset?: number;
  /** Hover delay before this tooltip opens, in ms. Defaults to 200, or to the
   *  ambient TooltipProvider's delayDuration when one is present. */
  delayDuration?: number;
  className?: string;
  /** Extra classes for the portalled positioner element — pass a z utility
   *  here to lift the whole tooltip above other fixed layers (default z-50). */
  contentClassName?: string;
  /** When true, forces the tooltip open. When false, forces it closed. When undefined, uses default hover/focus behavior. */
  forceOpen?: boolean;
  /** Follow the cursor along one axis while hovering the trigger — for tall
   *  or wide triggers (the Sidebar rail) where a centered tooltip sits far
   *  from the pointer. The other axis stays anchored by `side`. */
  followCursor?: "x" | "y";
  /** Called when the tooltip's internal open state changes (before forceOpen is applied). */
  onOpenChange?: (open: boolean) => void;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// Animation helpers
// ---------------------------------------------------------------------------

function getSlideOffset(side: TooltipSide) {
  switch (side) {
    case "top":
      return { y: 4 };
    case "bottom":
      return { y: -4 };
    case "left":
      return { x: 4 };
    case "right":
      return { x: -4 };
  }
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

function Tooltip(props: TooltipProps | any) {
  const hasAmbientProvider = useContext(TooltipGroupContext);

  // High-level API: <Tooltip content={...}>{children}</Tooltip>
  if (props.content !== undefined) {
    const {
      content,
      children,
      side = "top",
      sideOffset = 8,
      delayDuration = DEFAULT_DELAY,
      className,
      contentClassName,
      ...rest
    } = props as TooltipProps;

    const tooltipTree = (
      <TooltipPrimitive.Root {...rest}>
        <TooltipPrimitive.Trigger
          render={children as React.ReactElement}
          delay={delayDuration}
        />
        <TooltipContent
          side={side}
          sideOffset={sideOffset}
          className={cn(className, contentClassName)}
        >
          {content}
        </TooltipContent>
      </TooltipPrimitive.Root>
    );

    if (hasAmbientProvider) return tooltipTree;
    return (
      <TooltipPrimitive.Provider delay={delayDuration}>
        {tooltipTree}
      </TooltipPrimitive.Provider>
    );
  }

  // Low-level API (acts as TooltipPrimitive.Root)
  const { children, delayDuration, ...rest } = props;
  const tooltipRoot = (
    <TooltipPrimitive.Root {...rest}>
      {children}
    </TooltipPrimitive.Root>
  );
  if (hasAmbientProvider) return tooltipRoot;
  return (
    <TooltipPrimitive.Provider delay={delayDuration ?? DEFAULT_DELAY}>
      {tooltipRoot}
    </TooltipPrimitive.Provider>
  );
}

interface TooltipTriggerProps extends React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger> {
  children?: ReactNode;
}

function TooltipTrigger({ render, children, ...props }: TooltipTriggerProps) {
  return <TooltipPrimitive.Trigger render={render ?? (children as React.ReactElement)} {...props} />;
}

interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  side?: TooltipSide;
  sideOffset?: number;
  className?: string;
  [key: string]: any;
}

function TooltipContent({
  children,
  side = "top",
  sideOffset = 8,
  className,
  ...props
}: TooltipContentProps) {
  const shape = useShape();
  const slideOffset = getSlideOffset(side);
  const portalContainer = useContext(TooltipPortalContainerContext);

  return (
    <TooltipPrimitive.Portal container={portalContainer ?? undefined}>
      <TooltipPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        className="z-50"
      >
        <TooltipPrimitive.Popup
          render={(popupProps, state) => {
            const exiting = state.transitionStatus === "ending";
            const {
              style: baseStyle,
              onDrag: _onDrag,
              onDragStart: _onDragStart,
              onDragEnd: _onDragEnd,
              onAnimationStart: _onAnimationStart,
              onAnimationEnd: _onAnimationEnd,
              onAnimationIteration: _onAnimationIteration,
              ...rest
            } = popupProps as React.HTMLAttributes<HTMLDivElement>;
            return (
              <motion.div
                {...rest}
                className={cn(
                  "bg-foreground text-background text-[12px] px-2 py-1",
                  "[text-box:trim-both_cap_alphabetic] supports-[text-box:trim-both]:py-2",
                  shape.bg,
                  className
                )}
                style={{
                  ...(baseStyle as React.CSSProperties | undefined),
                  fontVariationSettings: fontWeights.medium,
                }}
                initial={{ opacity: 0, ...slideOffset }}
                animate={
                  exiting
                    ? { opacity: 0, ...slideOffset }
                    : { opacity: 1, x: 0, y: 0 }
                }
                transition={exiting ? spring.fast.exit : spring.fast}
              >
                {children}
              </motion.div>
            );
          }}
          {...props}
        />
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipPortalContainer, TooltipProvider, TooltipTrigger, TooltipContent };
export type { TooltipProps, TooltipProviderProps, TooltipSide, TooltipTriggerProps, TooltipContentProps };
