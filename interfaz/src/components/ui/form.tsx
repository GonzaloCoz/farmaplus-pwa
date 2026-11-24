import * as React from "react";
import { Form as BaseForm } from "@base-ui/react/form";
import { cn } from "@/lib/utils";

const Form = React.forwardRef<
  HTMLFormElement,
  React.ComponentPropsWithoutRef<typeof BaseForm>
>(({ className, ...props }, ref) => (
  <BaseForm
    ref={ref}
    className={cn("flex flex-col gap-6", className)}
    {...props}
  />
));
Form.displayName = "Form";

export { Form };
