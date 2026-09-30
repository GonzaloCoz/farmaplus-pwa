import * as React from "react";
import { Checkbox } from "@base-ui/react/checkbox";
import { Check, Minus } from '@untitledui/icons';

import { cn } from "@/lib/utils";

const CheckboxComponent = React.forwardRef<
  HTMLButtonElement,
  Omit<React.ComponentPropsWithoutRef<typeof Checkbox.Root>, "checked" | "onCheckedChange"> & {
    checked?: boolean | "indeterminate";
    onCheckedChange?: (checked: boolean | "indeterminate") => void;
  }
>(({ className, checked, onCheckedChange, ...props }, ref) => (
  <Checkbox.Root
    ref={ref}
    checked={checked as any}
    className={cn(
      "group flex size-4 shrink-0 items-center justify-center rounded-[5px] border shadow-2xs transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      "bg-surface-3 border-border/70 hover:border-foreground/40 dark:border-white/20 dark:hover:border-white/40",
      "data-[checked]:bg-foreground data-[checked]:border-foreground data-[checked]:text-background",
      "data-[indeterminate]:bg-foreground data-[indeterminate]:border-foreground data-[indeterminate]:text-background",
      className
    )}
    onCheckedChange={(checked) => onCheckedChange?.(checked as any)}
    {...props}
  >
    <Checkbox.Indicator className="flex items-center justify-center transition-all">
      <Check className="size-3 group-data-[indeterminate]:hidden stroke-[2.8]" />
      <Minus className="size-3 hidden group-data-[indeterminate]:block stroke-[2.8]" />
    </Checkbox.Indicator>
  </Checkbox.Root>
));
CheckboxComponent.displayName = "Checkbox";

export { CheckboxComponent as Checkbox };
