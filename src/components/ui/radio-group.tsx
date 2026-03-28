import * as React from "react";
import { RadioGroup as BaseRadioGroupRoot } from "@base-ui-components/react/radio-group";
import { Radio as BaseRadio } from "@base-ui-components/react/radio";
import { Widget as Circle } from "@solar-icons/react";

import { cn } from "@/lib/utils";

const RadioGroup = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof BaseRadioGroupRoot>
>(({ className, ...props }, ref) => {
  return <BaseRadioGroupRoot className={cn("grid gap-2", className)} {...props} ref={ref} />;
});
RadioGroup.displayName = "RadioGroup";

const RadioGroupItem = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof BaseRadio.Root>
>(({ className, ...props }, ref) => {
  return (
    <BaseRadio.Root
      ref={ref}
      className={cn(
        "group aspect-square h-4 w-4 rounded-full flex items-center justify-center border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <BaseRadio.Indicator className="flex items-center justify-center opacity-0 data-[checked]:opacity-100 transition-opacity">
        <Circle className="h-2.5 w-2.5 fill-current text-current" />
      </BaseRadio.Indicator>
    </BaseRadio.Root>
  );
});
RadioGroupItem.displayName = "RadioGroupItem";

export { RadioGroup, RadioGroupItem };
