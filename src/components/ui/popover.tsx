import * as React from "react";
import { Popover as BasePopover } from "@base-ui-components/react/popover";

import { cn } from "@/lib/utils";

const Popover = BasePopover.Root;

const PopoverTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof BasePopover.Trigger> & { render?: React.ReactElement }
>(({ render, ...props }, ref) => (
  <BasePopover.Trigger ref={ref} render={render} {...props} />
));
PopoverTrigger.displayName = "PopoverTrigger";

const PopoverPortal = BasePopover.Portal;

const PopoverContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof BasePopover.Popup> & { 
    align?: 'start' | 'center' | 'end'; 
    side?: 'top' | 'right' | 'bottom' | 'left';
    sideOffset?: number; 
    positionerClassName?: string; 
  }
>(({ className, align = "center", side = "bottom", sideOffset = 4, children, positionerClassName, ...props }, ref) => (
  <BasePopover.Portal>
    <BasePopover.Positioner
      sideOffset={sideOffset}
      align={align}
      side={side}
      className={cn(
        "z-50 outline-none",
        positionerClassName
      )}
    >
      <BasePopover.Popup
        ref={ref}
        className={cn(
          "z-50 w-72 rounded-lg border border-border/40 bg-background  p-4 text-popover-foreground shadow-md outline-none data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        {...props}
      >
        {children}
      </BasePopover.Popup>
    </BasePopover.Positioner>
  </BasePopover.Portal>
));
PopoverContent.displayName = "PopoverContent";

export { Popover, PopoverTrigger, PopoverContent, PopoverPortal };

