import * as React from "react";
import { Toolbar as BaseToolbar } from "@base-ui-components/react/toolbar";

import { cn } from "@/lib/utils";

const Toolbar = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof BaseToolbar.Root>
>(({ className, ...props }, ref) => (
  <BaseToolbar.Root
    ref={ref}
    className={cn(
      "flex h-10 items-center gap-1 rounded-xl border border-border/40 bg-background/50  px-1 py-1 shadow-sm",
      className
    )}
    {...props}
  />
));
Toolbar.displayName = "Toolbar";

const ToolbarButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof BaseToolbar.Button>
>(({ className, ...props }, ref) => (
  <BaseToolbar.Button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 transition-all active:scale-95",
      className
    )}
    {...props}
  />
));
ToolbarButton.displayName = "ToolbarButton";

const ToolbarSeparator = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof BaseToolbar.Separator>
>(({ className, ...props }, ref) => (
  <BaseToolbar.Separator
    ref={ref}
    className={cn("mx-1 h-4 w-px bg-border/40", className)}
    {...props}
  />
));
ToolbarSeparator.displayName = "ToolbarSeparator";

const ToolbarGroup = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center gap-1", className)}
    {...props}
  />
));
ToolbarGroup.displayName = "ToolbarGroup";

export { Toolbar, ToolbarButton, ToolbarSeparator, ToolbarGroup };

