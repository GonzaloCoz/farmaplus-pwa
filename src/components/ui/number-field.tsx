import * as React from "react";
import { NumberField as BaseNumberField } from "@base-ui-components/react/number-field";
import { Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

const NumberField = BaseNumberField.Root;

const NumberFieldInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentPropsWithoutRef<typeof BaseNumberField.Input>
>(({ className, ...props }, ref) => (
  <BaseNumberField.Input
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-xl border border-input bg-background px-10 py-2 text-center text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
      className
    )}
    {...props}
  />
));
NumberFieldInput.displayName = "NumberFieldInput";

const NumberFieldDecrement = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof BaseNumberField.Decrement>
>(({ className, ...props }, ref) => (
  <BaseNumberField.Decrement
    ref={ref}
    className={cn(
      "absolute left-1 top-1 bottom-1 flex aspect-square items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 disabled:pointer-events-none disabled:opacity-50 transition-all",
      className
    )}
    {...props}
  >
    <Minus className="h-4.5 w-4.5" />
  </BaseNumberField.Decrement>
));
NumberFieldDecrement.displayName = "NumberFieldDecrement";

const NumberFieldIncrement = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof BaseNumberField.Increment>
>(({ className, ...props }, ref) => (
  <BaseNumberField.Increment
    ref={ref}
    className={cn(
      "absolute right-1 top-1 bottom-1 flex aspect-square items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 disabled:pointer-events-none disabled:opacity-50 transition-all",
      className
    )}
    {...props}
  >
    <Plus className="h-4.5 w-4.5" />
  </BaseNumberField.Increment>
));
NumberFieldIncrement.displayName = "NumberFieldIncrement";

const NumberFieldScrubArea = BaseNumberField.ScrubArea;
const NumberFieldScrubAreaCursor = BaseNumberField.ScrubAreaCursor;

export {
  NumberField,
  NumberFieldInput,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldScrubArea,
  NumberFieldScrubAreaCursor,
};
