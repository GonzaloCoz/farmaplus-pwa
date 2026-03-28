import * as React from "react";
import { Combobox as BaseCombobox } from "@base-ui-components/react/combobox";
import { AltArrowDown as ChevronDown, CheckCircle as Check } from "@solar-icons/react";

import { cn } from "@/lib/utils";

const Combobox = BaseCombobox.Root;

const ComboboxInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentPropsWithoutRef<typeof BaseCombobox.Input>
>(({ className, ...props }, ref) => (
  <BaseCombobox.Input
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all",
      className
    )}
    {...props}
  />
));
ComboboxInput.displayName = "ComboboxInput";

const ComboboxTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof BaseCombobox.Trigger>
>(({ className, ...props }, ref) => (
  <BaseCombobox.Trigger
    ref={ref}
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all",
      className
    )}
    {...props}
  >
    <BaseCombobox.Value placeholder="Select option..." />
    <ChevronDown className="h-4.5 w-4.5 opacity-50 shrink-0" />
  </BaseCombobox.Trigger>
));
ComboboxTrigger.displayName = "ComboboxTrigger";

const ComboboxContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof BaseCombobox.Positioner>
>(({ className, children, ...props }, ref) => (
  <BaseCombobox.Portal>
    <BaseCombobox.Positioner
      ref={ref}
      className={cn("relative z-50", className)}
      {...props}
    >
      <BaseCombobox.Popup
        className={cn(
          "relative max-h-96 min-w-[var(--base-combobox-trigger-width)] overflow-hidden rounded-2xl border border-border/40 bg-background/95 backdrop-blur-xl text-popover-foreground shadow-2xl p-1 animate-in fade-in zoom-in-95 duration-200"
        )}
      >
        {children}
      </BaseCombobox.Popup>
    </BaseCombobox.Positioner>
  </BaseCombobox.Portal>
));
ComboboxContent.displayName = "ComboboxContent";

const ComboboxItem = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof BaseCombobox.Item>
>(({ className, children, ...props }, ref) => (
  <BaseCombobox.Item
    ref={ref}
    className={cn(
      "group relative flex w-full cursor-pointer select-none items-center rounded-xl py-2 pl-9 pr-3 text-[13px] font-medium outline-none transition-all data-[disabled]:pointer-events-none data-[disabled]:opacity-50 focus:bg-white/10 focus:text-foreground dark:focus:text-white active:scale-[0.98]",
      className
    )}
    {...props}
  >
    <span className="absolute left-3 flex h-3.5 w-3.5 items-center justify-center opacity-0 group-data-[selected]:opacity-100 transition-opacity">
      <Check className="h-4.5 w-4.5" />
    </span>
    {children}
  </BaseCombobox.Item>
));
ComboboxItem.displayName = "ComboboxItem";

const ComboboxList = BaseCombobox.List;
const ComboboxEmpty = BaseCombobox.Empty;
const ComboboxGroup = BaseCombobox.Group;
const ComboboxLabel = BaseCombobox.GroupLabel;

export {
  Combobox,
  ComboboxInput,
  ComboboxTrigger,
  ComboboxContent,
  ComboboxItem,
  ComboboxList,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxLabel,
};
