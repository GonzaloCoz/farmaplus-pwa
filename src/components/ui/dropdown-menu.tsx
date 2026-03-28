import * as React from "react";
import { Menu as BaseMenu } from "@base-ui-components/react/menu";
import { CheckCircle as Check, AltArrowRight as ChevronRight, MenuDots as Circle } from "@solar-icons/react";

import { cn } from "@/lib/utils";

const DropdownMenu = BaseMenu.Root;

const DropdownMenuTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof BaseMenu.Trigger> & { render?: React.ReactElement }
>(({ render, ...props }, ref) => (
  <BaseMenu.Trigger ref={ref} render={render} {...props} />
));
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

const DropdownMenuGroup = BaseMenu.Group;

const DropdownMenuPortal = BaseMenu.Portal;

const DropdownMenuSub = BaseMenu.SubmenuRoot;

const DropdownMenuRadioGroup = BaseMenu.RadioGroup;

const DropdownMenuSubTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof BaseMenu.SubmenuTrigger> & {
    inset?: boolean;
    render?: React.ReactElement;
  }
>(({ className, inset, children, render, ...props }, ref) => (
  <BaseMenu.SubmenuTrigger
    ref={ref}
    render={render}
    className={cn(
      "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[open]:bg-accent focus:bg-accent",
      inset && "pl-8",
      className,
    )}
    {...props}
  >
    {!render && (
      <>
        {children}
        <ChevronRight className="ml-auto h-4 w-4" />
      </>
    )}
    {render && children}
  </BaseMenu.SubmenuTrigger>
));
DropdownMenuSubTrigger.displayName = "DropdownMenuSubTrigger";

const DropdownMenuSubContent = React.forwardRef<
  HTMLDivElement,
  Omit<React.ComponentPropsWithoutRef<typeof BaseMenu.Positioner>, "children"> & { children?: React.ReactNode }
>(({ className, children, ...props }, ref) => (
  <BaseMenu.Portal>
    <BaseMenu.Positioner
      ref={ref}
      {...props}
    >
        <BaseMenu.Popup
          className={cn(
            "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
            className,
          )}
        >
          {children}
        </BaseMenu.Popup>
    </BaseMenu.Positioner>
  </BaseMenu.Portal>
));
DropdownMenuSubContent.displayName = "DropdownMenuSubContent";

const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  Omit<React.ComponentPropsWithoutRef<typeof BaseMenu.Positioner>, "children"> & { sideOffset?: number, children?: React.ReactNode }
>(({ className, sideOffset = 6, children, ...props }, ref) => (
  <DropdownMenuPortal>
    <BaseMenu.Positioner
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50",
        className,
      )}
      {...props}
    >
        <BaseMenu.Popup
            className={cn(
                "min-w-[9rem] overflow-hidden rounded-2xl border border-border/40 bg-background/95 backdrop-blur-xl p-1.5 text-popover-foreground shadow-2xl data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
            )}
        >
            {children}
        </BaseMenu.Popup>
    </BaseMenu.Positioner>
  </DropdownMenuPortal>
));
DropdownMenuContent.displayName = "DropdownMenuContent";

const DropdownMenuItem = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof BaseMenu.Item> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <BaseMenu.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center rounded-xl px-3 py-1.5 text-[12px] font-medium outline-none transition-all data-[disabled]:pointer-events-none data-[disabled]:opacity-50 focus:bg-white/10 focus:text-foreground dark:focus:text-white active:scale-[0.98] gap-3",
      inset && "pl-8",
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = "DropdownMenuItem";

const DropdownMenuCheckboxItem = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof BaseMenu.Item> & { checked?: boolean }
>(({ className, children, checked, ...props }, ref) => (
  <BaseMenu.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center rounded-xl py-1.5 pl-9 pr-3 text-[12px] font-medium outline-none transition-all data-[disabled]:pointer-events-none data-[disabled]:opacity-50 focus:bg-white/10 focus:text-foreground dark:focus:text-white active:scale-[0.98]",
      className,
    )}
    {...props}
  >
    <span className="absolute left-3 flex h-3.5 w-3.5 items-center justify-center">
      {checked && <Check className="h-4.5 w-4.5" />}
    </span>
    {children}
  </BaseMenu.Item>
));
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem";

const DropdownMenuRadioItem = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof BaseMenu.RadioItem>
>(({ className, children, ...props }, ref) => (
  <BaseMenu.RadioItem
    ref={ref}
    className={cn(
      "group relative flex cursor-pointer select-none items-center rounded-xl py-1.5 pl-9 pr-3 text-[12px] font-medium outline-none transition-all data-[disabled]:pointer-events-none data-[disabled]:opacity-50 focus:bg-white/10 focus:text-foreground dark:focus:text-white active:scale-[0.98]",
      className,
    )}
    {...props}
  >
    <span className="absolute left-3 flex h-3.5 w-3.5 items-center justify-center opacity-0 group-data-[checked]:opacity-100 transition-opacity">
        <Circle className="h-2 w-2 fill-current" />
    </span>
    {children}
  </BaseMenu.RadioItem>
));
DropdownMenuRadioItem.displayName = "DropdownMenuRadioItem";

const DropdownMenuLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("px-3 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50", inset && "pl-8", className)}
    {...props}
  />
));
DropdownMenuLabel.displayName = "DropdownMenuLabel";

const DropdownMenuSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("-mx-1 my-1.5 h-px bg-border/40", className)} {...props} />
));
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

const DropdownMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return <span className={cn("ml-auto text-xs tracking-widest opacity-60", className)} {...props} />;
};
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};
