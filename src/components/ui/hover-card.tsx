import * as React from "react"
import { Popover as BasePopover } from "@base-ui-components/react/popover"

import { cn } from "@/lib/utils"

// Base UI does not have a distinct HoverCard, but Popover can act as one with the right settings
// However, to perfectly match semantics, we use Popover with focus/hover triggers where available
const HoverCard = BasePopover.Root

const HoverCardTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof BasePopover.Trigger> & { render?: React.ReactElement }
>(({ render, ...props }, ref) => (
  <BasePopover.Trigger ref={ref} render={render} {...props} />
));
HoverCardTrigger.displayName = "HoverCardTrigger";

const HoverCardContent = React.forwardRef<
  HTMLDivElement,
  Omit<React.ComponentPropsWithoutRef<typeof BasePopover.Positioner>, "children"> & { align?: 'start' | 'center' | 'end'; sideOffset?: number; children?: React.ReactNode; }
>(({ className, align = "center", sideOffset = 4, children, ...props }, ref) => (
  <BasePopover.Portal>
    <BasePopover.Positioner
      ref={ref}
      sideOffset={sideOffset}
      align={align}
      className={cn(
        "z-50 outline-none",
        className
      )}
      {...props}
    >
      <BasePopover.Popup
        className={cn(
          "z-50 w-64 rounded-lg border border-border/40 bg-background  p-4 text-popover-foreground shadow-md outline-none data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        )}
      >
        {children}
      </BasePopover.Popup>
    </BasePopover.Positioner>
  </BasePopover.Portal>
))
HoverCardContent.displayName = "HoverCardContent"

export { HoverCard, HoverCardTrigger, HoverCardContent }

