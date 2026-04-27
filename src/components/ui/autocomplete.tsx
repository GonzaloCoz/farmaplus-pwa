import * as React from "react";
import { Autocomplete as BaseAutocomplete } from "@base-ui-components/react/autocomplete";
import { Magnifer as Search, CheckCircle as Check } from "@solar-icons/react";

import { cn } from "@/lib/utils";

const Autocomplete = BaseAutocomplete.Root;

const AutocompleteInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentPropsWithoutRef<typeof BaseAutocomplete.Input>
>(({ className, ...props }, ref) => (
  <div className="relative flex items-center w-full">
    <Search className="absolute left-3 h-4 w-4 opacity-50" />
    <BaseAutocomplete.Input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all",
        className
      )}
      {...props}
    />
  </div>
));
AutocompleteInput.displayName = "AutocompleteInput";

const AutocompleteContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof BaseAutocomplete.Positioner>
>(({ className, children, ...props }, ref) => (
  <BaseAutocomplete.Portal>
    <BaseAutocomplete.Positioner
      ref={ref}
      className={cn("relative z-50", className)}
      {...props}
    >
      <BaseAutocomplete.Popup
        className={cn(
          "relative max-h-96 min-w-[var(--base-autocomplete-trigger-width)] overflow-hidden rounded-lg border border-border/40 bg-background  text-popover-foreground shadow-md p-1 animate-in fade-in zoom-in-95 duration-200"
        )}
      >
        <div className="overflow-y-auto w-full">{children}</div>
      </BaseAutocomplete.Popup>
    </BaseAutocomplete.Positioner>
  </BaseAutocomplete.Portal>
));
AutocompleteContent.displayName = "AutocompleteContent";

const AutocompleteItem = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof BaseAutocomplete.Item>
>(({ className, children, ...props }, ref) => (
  <BaseAutocomplete.Item
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
  </BaseAutocomplete.Item>
));
AutocompleteItem.displayName = "AutocompleteItem";

const AutocompleteList = BaseAutocomplete.List;
const AutocompleteEmpty = BaseAutocomplete.Empty;
const AutocompleteGroup = BaseAutocomplete.Group;
const AutocompleteLabel = BaseAutocomplete.GroupLabel;

export {
  Autocomplete,
  AutocompleteInput,
  AutocompleteContent,
  AutocompleteItem,
  AutocompleteList,
  AutocompleteEmpty,
  AutocompleteGroup,
  AutocompleteLabel,
};

