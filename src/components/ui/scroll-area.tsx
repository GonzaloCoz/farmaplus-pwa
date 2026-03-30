"use client";

import { ScrollArea as ScrollAreaPrimitive } from "@base-ui-components/react/scroll-area";
import * as React from "react";
import { cn } from "@/lib/utils";

const ScrollArea = React.forwardRef<
  HTMLDivElement,
  ScrollAreaPrimitive.Root.Props & {
    scrollFade?: boolean;
    scrollbarGutter?: boolean;
  }
>(({ className, children, scrollFade = false, scrollbarGutter = false, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn(
      "relative overflow-hidden",
      scrollbarGutter && "scrollbar-gutter-stable",
      className
    )}
    {...props}
  >
    {children}
    <ScrollAreaCorner />
  </ScrollAreaPrimitive.Root>
));
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollAreaViewport = React.forwardRef<
  HTMLDivElement,
  ScrollAreaPrimitive.Viewport.Props & { scrollFade?: boolean }
>(({ className, children, scrollFade, ...props }, ref) => (
  <ScrollAreaPrimitive.Viewport
    ref={ref}
    className={cn(
      "h-full w-full rounded-[inherit] outline-none",
      scrollFade && "mask-fade-v",
      className
    )}
    {...props}
  >
    {children}
  </ScrollAreaPrimitive.Viewport>
));
ScrollAreaViewport.displayName = ScrollAreaPrimitive.Viewport.displayName;

const ScrollAreaScrollbar = React.forwardRef<
  HTMLDivElement,
  ScrollAreaPrimitive.Scrollbar.Props
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.Scrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors duration-200",
      orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className
    )}
    {...props}
  >
    <ScrollAreaThumb />
  </ScrollAreaPrimitive.Scrollbar>
));
ScrollAreaScrollbar.displayName = ScrollAreaPrimitive.Scrollbar.displayName;

const ScrollAreaThumb = React.forwardRef<
  HTMLDivElement,
  ScrollAreaPrimitive.Thumb.Props
>(({ className, ...props }, ref) => (
  <ScrollAreaPrimitive.Thumb
    ref={ref}
    className={cn(
      "relative flex-1 rounded-full bg-muted-foreground/32 transition-colors hover:bg-muted-foreground/48 dark:bg-white/16 dark:hover:bg-white/32",
      className
    )}
    {...props}
  />
));
ScrollAreaThumb.displayName = ScrollAreaPrimitive.Thumb.displayName;

const ScrollAreaCorner = ScrollAreaPrimitive.Corner;

export {
  ScrollArea,
  ScrollAreaViewport,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaCorner,
};
