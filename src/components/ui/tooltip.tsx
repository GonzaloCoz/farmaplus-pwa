import * as React from "react";
import { Tooltip as BaseTooltip } from "@base-ui-components/react/tooltip";

import { cn } from "@/lib/utils";

const TooltipProvider = ({ children, delayDuration }: { children: React.ReactNode, delayDuration?: number }) => <>{children}</>;

const Tooltip = BaseTooltip.Root;

const TooltipTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof BaseTooltip.Trigger> & { render?: React.ReactElement }
>(({ render, ...props }, ref) => (
  <BaseTooltip.Trigger ref={ref} render={render} {...props} />
));
TooltipTrigger.displayName = "TooltipTrigger";

const TooltipContent = React.forwardRef<
  HTMLDivElement,
  Omit<React.ComponentPropsWithoutRef<typeof BaseTooltip.Positioner>, "children"> & { sideOffset?: number; children?: React.ReactNode; }
>(({ className, sideOffset = 4, children, ...props }, ref) => (
  <BaseTooltip.Portal>
    <BaseTooltip.Positioner
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50",
        className
      )}
      {...props}
    >
      <BaseTooltip.Popup
        className={cn(
          "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        )}
      >
          {children}
      </BaseTooltip.Popup>
    </BaseTooltip.Positioner>
  </BaseTooltip.Portal>
));
TooltipContent.displayName = "TooltipContent";

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
