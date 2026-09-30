"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useShape } from "@/lib/shape-context";
import { useSizeVariant } from "@/lib/size-context";

const badgeColors = {
  gray: "oklch(0.715 0.000 89.876)",
  red: "oklch(0.637 0.208 25.331)",
  orange: "oklch(0.705 0.187 47.604)",
  amber: "oklch(0.769 0.165 70.080)",
  yellow: "oklch(0.795 0.162 86.047)",
  lime: "oklch(0.768 0.204 130.850)",
  green: "oklch(0.723 0.192 149.579)",
  emerald: "oklch(0.696 0.149 162.480)",
  teal: "oklch(0.704 0.123 182.503)",
  cyan: "oklch(0.715 0.126 215.221)",
  blue: "oklch(0.623 0.188 259.815)",
  indigo: "oklch(0.585 0.204 277.117)",
  violet: "oklch(0.606 0.219 292.717)",
  purple: "oklch(0.627 0.233 303.900)",
  fuchsia: "oklch(0.667 0.259 322.150)",
  pink: "oklch(0.656 0.212 354.308)",
  rose: "oklch(0.645 0.215 16.439)",
} as const;

type BadgeColor = keyof typeof badgeColors;

const badgeVariants = cva(
  "inline-flex items-center justify-center font-medium whitespace-nowrap leading-none select-none",
  {
    variants: {
      variant: {
        solid: "",
        dot: "border border-border text-foreground",
        outline: "border border-border text-foreground bg-transparent",
      },
      // The two-step size ladder shared by every control — see /docs/sizes.
      size: {
        default: "h-6 px-2.5 text-[12px] gap-1.5",
        compact: "h-5 px-2 text-[11px] gap-1",
      },
    },
    defaultVariants: {
      variant: "solid",
      size: "default",
    },
  }
);

type BadgeSizeCanonical = "default" | "compact";

/** Public size values: the canonical two-size scale plus the pre-sizes-system
 *  aliases, kept so existing call sites keep compiling. Aliases resolve onto
 *  the canonical ladder (sm → compact; md/lg → default). */
type BadgeSize = BadgeSizeCanonical | "sm" | "md" | "lg";

const legacySizeAliases: Partial<Record<BadgeSize, BadgeSizeCanonical>> = {
  sm: "compact",
  md: "default",
  lg: "default",
};

interface BadgeProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "color">,
    Omit<VariantProps<typeof badgeVariants>, "size"> {
  color?: BadgeColor;
  /** Omitted, the badge follows the surrounding SizeProvider. Legacy
   *  sm/md/lg values still resolve. */
  size?: BadgeSize;
  showDot?: boolean;
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      className,
      variant = "solid",
      size: sizeProp,
      color = "gray",
      showDot,
      children,
      style,
      ...props
    },
    ref
  ) => {
    const shape = useShape();
    // Resolve the size: explicit prop (legacy aliases mapped onto the
    // canonical ladder) > surrounding SizeProvider > default.
    const contextSize = useSizeVariant();
    const size: BadgeSizeCanonical = sizeProp
      ? legacySizeAliases[sizeProp] ?? (sizeProp as BadgeSizeCanonical)
      : contextSize === "compact"
        ? "compact"
        : "default";
    const colorValue = badgeColors[color];
    const isSolid = variant === "solid";
    const isDot = variant === "dot" && showDot !== false;
    const dotSize = size === "compact" ? 6 : 7;

    const colorStyle = isSolid
      ? color === "gray"
        ? { backgroundColor: "var(--accent)", color: "var(--foreground)" }
        : {
            backgroundColor: `color-mix(in oklch, ${colorValue} 14%, var(--background))`,
            color: `color-mix(in oklch, ${colorValue} 85%, var(--foreground))`,
            borderColor: `color-mix(in oklch, ${colorValue} 20%, transparent)`,
            borderWidth: "1px",
            borderStyle: "solid",
          }
      : {};

    const dotColor = color === "gray" ? "var(--muted-foreground)" : colorValue;

    return (
      <span
        ref={ref}
        className={cn(badgeVariants({ variant, size }), shape.item, className)}
        style={{ ...colorStyle, ...style }}
        {...props}
      >
        {isDot && (
          <span
            className="shrink-0 rounded-full"
            style={{
              width: dotSize,
              height: dotSize,
              backgroundColor: dotColor,
            }}
          />
        )}
        {/* Center label content optically with normalized line-height */}
        <span className="inline-flex items-center justify-center leading-none translate-y-[0.5px]">
          {children}
        </span>
      </span>
    );
  }
);

Badge.displayName = "Badge";

export { Badge, badgeVariants, badgeColors };
export type { BadgeProps, BadgeColor, BadgeSize };
