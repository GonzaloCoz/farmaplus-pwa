import * as React from "react";
import { Select as BaseSelect } from "@base-ui-components/react/select";
import { CheckCircle as Check, AltArrowDown as ChevronDown, AltArrowUp as ChevronUp } from "@solar-icons/react";

import { cn } from "@/lib/utils";

const Select = BaseSelect.Root;

const SelectGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => (
  <div ref={ref} role="group" {...props} />
));
SelectGroup.displayName = "SelectGroup";

const SelectValue = BaseSelect.Value;

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof BaseSelect.Trigger> & { render?: React.ReactElement }
>(({ className, children, render, ...props }, ref) => {
  const content = (
    <>
      {children}
      <ChevronDown className="h-4 w-4 opacity-50" />
    </>
  );

  return (
    <BaseSelect.Trigger
      ref={ref}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
        className,
      )}
      render={render}
      {...props}
    >
      {render ? null : content}
    </BaseSelect.Trigger>
  );
});
SelectTrigger.displayName = "SelectTrigger";

const SelectScrollUpButton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(() => null);
SelectScrollUpButton.displayName = "SelectScrollUpButton";

const SelectScrollDownButton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(() => null);
SelectScrollDownButton.displayName = "SelectScrollDownButton";

const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof BaseSelect.Popup> & { align?: 'start' | 'center' | 'end'; position?: "popper" | "item-aligned"; positionerClassName?: string; }
>(({ className, children, align = "center", position = "popper", positionerClassName, ...props }, ref) => (
  <BaseSelect.Portal>
    <BaseSelect.Positioner
      align={align}
      className={cn(
        "relative z-50",
        positionerClassName
      )}
    >
        <BaseSelect.Popup
          ref={ref}
          className={cn(
            "relative max-h-96 min-w-[9rem] overflow-hidden rounded-2xl border border-border/40 bg-background/95 backdrop-blur-xl text-popover-foreground shadow-2xl p-1",
            position === "popper" && "w-full min-w-[var(--base-select-trigger-width)]",
            className
          )}
          {...props}
        >
          {children}
        </BaseSelect.Popup>
    </BaseSelect.Positioner>
  </BaseSelect.Portal>
));
SelectContent.displayName = "SelectContent";

const SelectLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)} {...props} />
));
SelectLabel.displayName = "SelectLabel";

const SelectItem = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof BaseSelect.Item>
>(({ className, children, ...props }, ref) => (
  <BaseSelect.Item
    ref={ref}
    className={cn(
      "group relative flex w-full cursor-pointer select-none items-center rounded-xl py-2 pl-9 pr-3 text-[13px] font-medium outline-none transition-all data-[disabled]:pointer-events-none data-[disabled]:opacity-50 focus:bg-white/10 focus:text-foreground dark:focus:text-white active:scale-[0.98]",
      className,
    )}
    {...props}
  >
    <span className="absolute left-3 flex h-3.5 w-3.5 items-center justify-center opacity-0 group-data-[selected]:opacity-100 transition-opacity">
        <Check className="h-4.5 w-4.5" />
    </span>

    <BaseSelect.ItemText>{children}</BaseSelect.ItemText>
  </BaseSelect.Item>
));
SelectItem.displayName = "SelectItem";

const SelectSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />
));
SelectSeparator.displayName = "SelectSeparator";

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
