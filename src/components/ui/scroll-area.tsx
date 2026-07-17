"use client";

// Base UI flavour of the Fluid Functionalism scroll area. Same API and
// behaviour as the Radix flavour (registry/radix/scroll-area.tsx): shape-system
// scrollbar, native overflow fallback on touch-primary devices. Scrollbar
// machinery adapted from Lina by SameerJS6 (https://lina.sameer.sh); built on
// @base-ui/react/scroll-area, whose scrollbars stay mounted while scrollable
// and expose hover/scroll state as data attributes instead of Radix's
// show/hide presence animation.

import {
  createContext,
  forwardRef,
  useContext,
  Children,
  type ComponentPropsWithoutRef,
  type ComponentRef,
} from "react";
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import { cn } from "@/lib/utils";
import { useShape } from "@/lib/shape-context";
import { useTouchPrimary } from "@/hooks/use-touch-primary";

// On touch-primary devices the Base UI machinery is skipped entirely in
// favour of native overflow scrolling (better physics, momentum,
// rubber-banding); the context lets the exported ScrollBar no-op there.
const ScrollAreaContext = createContext<boolean>(false);

type Orientation = "vertical" | "horizontal" | "both";

interface ScrollAreaProps extends ComponentPropsWithoutRef<"div"> {
  viewportClassName?: string;
  /** Which axes get scrollbars. Defaults to `"vertical"`. */
  orientation?: Orientation;
}

const ScrollArea = forwardRef<
  ComponentRef<typeof ScrollAreaPrimitive.Root>,
  ScrollAreaProps
>(
  (
    {
      className,
      children,
      viewportClassName,
      orientation = "vertical",
      ...props
    },
    ref
  ) => {
    const isTouch = useTouchPrimary();

    // Check if the old low-level API is being used (children includes ScrollAreaViewport)
    const hasViewport = Children.toArray(children).some(
      (child: any) => child?.type?.displayName === "ScrollAreaViewport"
    );

    if (hasViewport) {
      return (
        <ScrollAreaContext.Provider value={isTouch}>
          {isTouch ? (
            <div
              ref={ref}
              role="group"
              data-slot="scroll-area"
              aria-roledescription="scroll area"
              className={cn("relative overflow-hidden", className)}
              {...props}
            >
              {children}
            </div>
          ) : (
            <ScrollAreaPrimitive.Root
              ref={ref}
              data-slot="scroll-area"
              className={cn("relative overflow-hidden", className)}
              {...props}
            >
              {children}
            </ScrollAreaPrimitive.Root>
          )}
        </ScrollAreaContext.Provider>
      );
    }

    return (
      <ScrollAreaContext.Provider value={isTouch}>
        {isTouch ? (
          <div
            ref={ref}
            role="group"
            data-slot="scroll-area"
            aria-roledescription="scroll area"
            className={cn("relative overflow-hidden", className)}
            {...props}
          >
            <div
              data-slot="scroll-area-viewport"
              className={cn(
                "size-full rounded-[inherit]",
                orientation === "vertical" && "overflow-y-auto",
                orientation === "horizontal" && "overflow-x-auto",
                orientation === "both" && "overflow-auto",
                viewportClassName
              )}
              tabIndex={0}
            >
              {children}
            </div>
          </div>
        ) : (
          <ScrollAreaPrimitive.Root
            ref={ref}
            data-slot="scroll-area"
            className={cn("relative overflow-hidden", className)}
            {...props}
          >
            <ScrollAreaPrimitive.Viewport
              data-slot="scroll-area-viewport"
              className={cn("size-full rounded-[inherit]", viewportClassName)}
            >
              {/* Content gives Base UI an intrinsic size to measure
                  horizontal overflow against. */}
              <ScrollAreaPrimitive.Content>
                {children}
              </ScrollAreaPrimitive.Content>
            </ScrollAreaPrimitive.Viewport>
            {orientation !== "horizontal" && <ScrollBar orientation="vertical" />}
            {orientation !== "vertical" && <ScrollBar orientation="horizontal" />}
            {orientation === "both" && <ScrollAreaPrimitive.Corner />}
          </ScrollAreaPrimitive.Root>
        )}
      </ScrollAreaContext.Provider>
    );
  }
);

ScrollArea.displayName = "ScrollArea";

const ScrollBar = forwardRef<
  ComponentRef<typeof ScrollAreaPrimitive.Scrollbar>,
  ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Scrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => {
  const isTouch = useContext(ScrollAreaContext);
  const shape = useShape();

  if (isTouch) return null;

  return (
    <ScrollAreaPrimitive.Scrollbar
      ref={ref}
      orientation={orientation}
      data-slot="scroll-area-scrollbar"
      className={cn(
        "group/scrollbar absolute z-20 flex touch-none select-none",
        "opacity-0 transition-opacity duration-120 ease-out delay-160",
        "data-[hovering]:duration-160 data-[scrolling]:duration-160",
        "data-[hovering]:opacity-100 data-[scrolling]:opacity-100",
        "data-[hovering]:delay-0 data-[scrolling]:delay-0",
        orientation === "vertical" && "top-0 right-0 h-full w-2.5",
        orientation === "horizontal" && "bottom-0 left-0 h-2.5 w-full flex-col",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className={cn(
          "relative bg-foreground/25 transition-[background-color,width,height] duration-160 ease-in-out",
          "group-hover/scrollbar:bg-foreground/45 active:!bg-foreground/60",
          shape.bg,
          orientation === "vertical" &&
            "mx-auto my-1 w-1 h-[var(--scroll-area-thumb-height)] group-hover/scrollbar:w-1.5",
          orientation === "horizontal" &&
            "my-auto mx-1 h-1 w-[var(--scroll-area-thumb-width)] group-hover/scrollbar:h-1.5"
        )}
      />
    </ScrollAreaPrimitive.Scrollbar>
  );
});

ScrollBar.displayName = "ScrollBar";

const ScrollAreaViewport = forwardRef<any, any>(
  ({ className, children, scrollFade, ...props }, ref) => {
    const isTouch = useContext(ScrollAreaContext);

    if (isTouch) {
      return (
        <div
          ref={ref}
          data-slot="scroll-area-viewport"
          className={cn("size-full rounded-[inherit] overflow-y-auto", className)}
          tabIndex={0}
          {...props}
        >
          {children}
        </div>
      );
    }

    return (
      <ScrollAreaPrimitive.Viewport
        ref={ref}
        data-slot="scroll-area-viewport"
        className={cn("size-full rounded-[inherit]", className)}
        {...props}
      >
        <ScrollAreaPrimitive.Content>
          {children}
        </ScrollAreaPrimitive.Content>
      </ScrollAreaPrimitive.Viewport>
    );
  }
);

ScrollAreaViewport.displayName = "ScrollAreaViewport";

const ScrollAreaScrollbar = ScrollBar;

export { ScrollArea, ScrollBar, ScrollAreaViewport, ScrollAreaScrollbar };
export type { ScrollAreaProps };
