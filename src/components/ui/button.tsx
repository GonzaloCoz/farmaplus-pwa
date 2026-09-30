"use client";

import {
  cloneElement,
  forwardRef,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import type { IconComponent } from "@/lib/icon-context";
import { cn } from "@/lib/utils";
import { useShape } from "@/lib/shape-context";
import { useSizeVariant } from "@/lib/size-context";

const buttonVariants = cva(
  [
    "group relative inline-flex items-center justify-center outline-none cursor-pointer select-none whitespace-nowrap",
    "transition-all duration-80 active:scale-[0.98]",
    "disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed",
    "focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring,#6B97FF)] focus-visible:ring-offset-1",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        primary:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        tertiary:
          "border border-border bg-transparent text-muted-foreground hover:bg-hover hover:text-foreground",
        outline:
          "border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground text-foreground",
        ghost:
          "bg-transparent text-muted-foreground hover:bg-hover hover:text-foreground",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20",
        "destructive-outline":
          "border border-destructive/20 text-destructive-foreground bg-background shadow-xs hover:bg-destructive/[0.04]",
        link:
          "text-primary underline-offset-4 hover:underline bg-transparent",
      },
      size: {
        default: "h-9 px-4 text-[13px] gap-1.5",
        compact: "h-7 px-3 text-[12px] gap-1",
        sm: "h-8 px-3 text-xs gap-1.5",
        xs: "h-6 px-2 text-[10px] gap-1",
        lg: "h-10 px-6 text-sm gap-2",
        xl: "h-12 px-8 text-base gap-2",
        icon: "size-9 p-0 [&_svg]:size-4",
        "icon-compact": "size-7 p-0 [&_svg]:size-3.5",
        "icon-sm": "size-8 p-0 [&_svg]:size-3.5",
        "icon-xs": "size-6 p-0 [&_svg]:size-3",
        "icon-lg": "size-10 p-0 [&_svg]:size-5",
        "icon-xl": "size-12 p-0 [&_svg]:size-6",
      },
      iconLeft: { true: "" },
      iconRight: { true: "" },
    },
    compoundVariants: [
      { size: "compact", iconLeft: true, className: "pl-[6px]" },
      { size: "default", iconLeft: true, className: "pl-[10px]" },
      { size: "compact", iconRight: true, className: "pr-[6px]" },
      { size: "default", iconRight: true, className: "pr-[10px]" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

type ButtonSizeCanonical =
  | "default"
  | "compact"
  | "sm"
  | "xs"
  | "lg"
  | "xl"
  | "icon"
  | "icon-compact"
  | "icon-sm"
  | "icon-xs"
  | "icon-lg"
  | "icon-xl";

type ButtonSize = ButtonSizeCanonical | string;

const legacySizeAliases: Partial<Record<string, ButtonSizeCanonical>> = {
  sm: "sm",
  compact: "compact",
  md: "default",
  lg: "lg",
  xl: "xl",
  "icon-sm": "icon-sm",
  "icon-compact": "icon-compact",
  "icon-lg": "icon-lg",
  "icon-xl": "icon-xl",
  "icon-xs": "icon-xs",
  icon: "icon",
};

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    Omit<VariantProps<typeof buttonVariants>, "size"> {
  size?: ButtonSize;
  asChild?: boolean;
  render?: ReactElement;
  loading?: boolean;
  leadingIcon?: IconComponent;
  trailingIcon?: IconComponent;
  active?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      render,
      loading = false,
      leadingIcon: LeadingIcon,
      trailingIcon: TrailingIcon,
      active = false,
      disabled,
      children,
      style,
      ...props
    },
    ref
  ) => {
    const targetElement = render || (asChild && isValidElement(children) ? (children as ReactElement) : null);
    const label = targetElement ? targetElement.props.children : children;

    const contextSize = useSizeVariant();
    const resolvedSize: ButtonSizeCanonical = size
      ? (legacySizeAliases[size] ?? (size as ButtonSizeCanonical))
      : contextSize === "compact"
        ? "compact"
        : "default";

    const isIconOnly =
      resolvedSize === "icon" ||
      resolvedSize === "icon-compact" ||
      resolvedSize === "icon-sm" ||
      resolvedSize === "icon-xs" ||
      resolvedSize === "icon-lg" ||
      resolvedSize === "icon-xl";

    const isCompact =
      resolvedSize === "compact" ||
      resolvedSize === "icon-compact" ||
      resolvedSize === "sm" ||
      resolvedSize === "icon-sm";

    const iconSize = isCompact ? 14 : 16;
    const spinnerSizeClass = isCompact ? "h-4 w-4" : "h-4.5 w-4.5";
    const shape = useShape();

    const rootClassName = cn(
      buttonVariants({
        variant: variant as any,
        size: resolvedSize as any,
        iconLeft: !isIconOnly && !!LeadingIcon,
        iconRight: !isIconOnly && !!TrailingIcon,
      }),
      shape.button,
      active && "bg-active text-foreground",
      className
    );

    const internals = (
      <>
        {loading ? (
          <>
            <span className="flex items-center justify-center gap-[inherit] opacity-0">
              {LeadingIcon && !isIconOnly && (
                <LeadingIcon size={iconSize} strokeWidth={2} />
              )}
              {label}
              {TrailingIcon && !isIconOnly && (
                <TrailingIcon size={iconSize} strokeWidth={2} />
              )}
            </span>
            <span className="absolute inset-0 flex items-center justify-center">
              <svg
                className={cn("animate-spin text-current", spinnerSizeClass)}
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </span>
          </>
        ) : isIconOnly ? (
          <span className="inline-flex items-center justify-center">
            {label}
          </span>
        ) : (
          <>
            {LeadingIcon && (
              <LeadingIcon
                size={iconSize}
                strokeWidth={1.75}
                className="transition-[stroke-width] duration-80 group-hover:stroke-[2]"
              />
            )}
            {typeof label === "string" || typeof label === "number" ? (
              <span>{label}</span>
            ) : (
              label
            )}
            {TrailingIcon && (
              <TrailingIcon
                size={iconSize}
                strokeWidth={1.75}
                className="transition-[stroke-width] duration-80 group-hover:stroke-[2]"
              />
            )}
          </>
        )}
      </>
    );

    if (targetElement) {
      return cloneElement(
        targetElement,
        {
          ...props,
          ref,
          className: cn(rootClassName, targetElement.props.className),
          style: { ...style, ...targetElement.props.style },
          disabled: disabled || loading,
          "aria-disabled": disabled || loading || undefined,
        },
        internals
      );
    }

    return (
      <ButtonPrimitive
        ref={ref as React.Ref<HTMLButtonElement>}
        className={rootClassName}
        disabled={disabled || loading}
        style={style}
        {...props}
      >
        {internals}
      </ButtonPrimitive>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
export type { ButtonProps, ButtonSize };
