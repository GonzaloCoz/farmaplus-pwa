import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 relative before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:shadow-[0_1px_rgba(255,255,255,0.15)]",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60 relative before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:shadow-[0_1px_rgba(255,255,255,0.15)]",
        "destructive-outline":
          "border border-destructive/20 text-destructive-foreground bg-background shadow-xs hover:bg-destructive/[0.04] dark:hover:bg-destructive/10",
        outline:
          "border border-input bg-background shadow-sm shadow-black/5 dark:shadow-white/5 dark:bg-input/20 hover:bg-accent hover:text-accent-foreground text-foreground relative before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:shadow-[0_1px_rgba(0,0,0,0.04)] dark:before:shadow-[0_-1px_rgba(255,255,255,0.06)]",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80 relative before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:shadow-[0_1px_rgba(255,255,255,0.1)]",
        ghost:
          "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-6 rounded-md px-2 text-[10px]",
        sm: "h-8 rounded-md gap-1.5 px-3 text-xs",
        default: "h-9 px-4 py-2",
        lg: "h-10 rounded-md px-6",
        xl: "h-12 rounded-lg px-8 text-base",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg]:size-3.5",
        "icon-sm": "size-8 rounded-md [&_svg]:size-3.5",
        "icon-lg": "size-10 rounded-md",
        "icon-xl": "size-12 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  render?: React.ReactElement;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading = false, render, children, disabled, ...props }, ref) => {
    const isDisabled = disabled || loading;

    const content = loading ? (
      <>
        <LoaderCircle
          className="animate-spin"
          data-slot="button-loading-indicator"
        />
        <span className="contents">{children}</span>
      </>
    ) : (
      children
    );

    if (render) {
      return React.cloneElement(render, {
        ...props,
        disabled: isDisabled,
        "aria-disabled": isDisabled || undefined,
        "data-loading": loading || undefined,
        "data-slot": "button",
        className: cn(buttonVariants({ variant, size, className }), render.props.className),
        ref,
        children: content,
      });
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isDisabled}
        aria-disabled={isDisabled || undefined}
        data-loading={loading || undefined}
        data-slot="button"
        {...props}
      >
        {content}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
