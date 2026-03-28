import * as React from "react";
import { Checkbox } from "@base-ui-components/react/checkbox";
import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

const CheckboxComponent = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof Checkbox.Root> & {
    checked?: boolean | "indeterminate";
    onCheckedChange?: (checked: boolean | "indeterminate") => void;
  }
>(({ className, onCheckedChange, ...props }, ref) => (
  <Checkbox.Root
    ref={ref}
    className={cn(
      "group flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-border/60 bg-white dark:bg-muted/30 transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:bg-primary data-[checked]:border-primary data-[indeterminate]:bg-primary data-[indeterminate]:border-primary hover:border-border",
      className
    )}
    onCheckedChange={(checked) => onCheckedChange?.(checked)}
    {...props}
  >
    <Checkbox.Indicator className="flex items-center justify-center text-primary-foreground transition-all">
      <Check className="size-3 group-data-[indeterminate]:hidden" strokeWidth={4} />
      <Minus className="size-3 hidden group-data-[indeterminate]:block" strokeWidth={4} />
    </Checkbox.Indicator>
  </Checkbox.Root>
));
CheckboxComponent.displayName = "Checkbox";

export { CheckboxComponent as Checkbox };
