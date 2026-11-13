"use client";

import React, { forwardRef, useState } from "react";
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { omit } from "@/lib/omit";
import { useSize, type SizeVariant } from "@/lib/size-context";

// ---------------------------------------------------------------------------
// Official @fluid/base/checkbox:
// A single checkbox: the CheckboxGroup square on its own. A 1.5px --border
// box that darkens on hover; checked, the box steps back and a drawn check
// alone marks the state. Pair it with Field and FieldLabel for its text.
// ---------------------------------------------------------------------------

export interface CheckboxProps
  extends Omit<
    CheckboxPrimitive.Root.Props,
    "checked" | "defaultChecked" | "onCheckedChange" | "className"
  > {
  checked?: boolean;
  defaultChecked?: boolean;
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
  size?: SizeVariant;
}

export const Checkbox = forwardRef<HTMLElement, CheckboxProps>(
  (
    {
      className,
      checked,
      defaultChecked = false,
      indeterminate = false,
      onCheckedChange,
      onKeyDown,
      size,
      ...props
    },
    ref
  ) => {
    const [uncontrolled, setUncontrolled] = useState(defaultChecked);
    const isChecked = checked ?? uncontrolled;
    const glyph = indeterminate ? "dash" : isChecked ? "check" : null;
    const compact = useSize(size).variant === "compact";

    return (
      <CheckboxPrimitive.Root
        ref={ref}
        data-slot="checkbox"
        checked={isChecked}
        indeterminate={indeterminate}
        onCheckedChange={(next) => {
          if (checked === undefined) setUncontrolled(next);
          onCheckedChange?.(next);
        }}
        onKeyDown={(e) => {
          const card = e.currentTarget.closest("[data-slot=field-label]");
          if (
            e.key === "Enter" &&
            !e.repeat &&
            card?.querySelector(":scope > [data-slot=field]")
          ) {
            e.preventDefault();
            e.currentTarget.click();
          }
          onKeyDown?.(e);
        }}
        className={cn(
          "relative inline-block shrink-0 cursor-pointer border-[1.5px] border-solid border-border bg-transparent p-0 outline-none",
          "transition-[border-color] duration-80",
          "hover:not-data-checked:border-foreground/40 group-hover/field:not-data-checked:border-foreground/40",
          "data-checked:border-transparent data-indeterminate:border-transparent",
          "hover:data-checked:border-foreground/40 group-hover/field:not-data-disabled:data-checked:border-foreground/40",
          "aria-invalid:not-data-checked:border-destructive/50",
          "focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
          "data-disabled:pointer-events-none data-disabled:opacity-50",
          compact ? "size-[14px] rounded-[4px]" : "size-4 rounded-[5px]",
          className
        )}
        {...props}
      >
        <AnimatePresence initial={false}>
          {glyph && (
            <CheckboxPrimitive.Indicator
              keepMounted
              render={(indicatorProps) => {
                const rest = omit(
                  indicatorProps as React.HTMLAttributes<SVGSVGElement>,
                  [
                    "style",
                    "onDrag",
                    "onDragStart",
                    "onDragEnd",
                    "onAnimationStart",
                    "onAnimationEnd",
                    "onAnimationIteration",
                  ]
                );
                return (
                  <motion.svg
                    {...rest}
                    width={compact ? 16 : 18}
                    height={compact ? 16 : 18}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-foreground"
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 1 }}
                  >
                    <motion.path
                      key={glyph}
                      d={glyph === "dash" ? "M7 12H17" : "M6 12L10 16L18 8"}
                      initial={{ pathLength: 0 }}
                      animate={{
                        pathLength: 1,
                        transition: { duration: 0.08, ease: "easeOut" },
                      }}
                      exit={{
                        pathLength: 0,
                        transition: { duration: 0.04, ease: "easeIn" },
                      }}
                    />
                  </motion.svg>
                );
              }}
            />
          )}
        </AnimatePresence>
      </CheckboxPrimitive.Root>
    );
  }
);
Checkbox.displayName = "Checkbox";

// ---------------------------------------------------------------------------
// Legacy solid-box FluidCheckbox preserved for existing table/settings callers
// ---------------------------------------------------------------------------

export interface FluidCheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onToggle: () => void;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

export function FluidCheckbox({
  checked,
  indeterminate = false,
  onToggle,
  className,
  disabled = false,
  "aria-label": ariaLabel,
}: FluidCheckboxProps) {
  const isCheckedOrIndeterminate = checked || indeterminate;

  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={ariaLabel}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.9 }}
      transition={{ type: "spring", stiffness: 450, damping: 25 }}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onToggle();
      }}
      className={cn(
        "relative w-4 h-4 shrink-0 rounded-[5px] border select-none inline-flex items-center justify-center transition-colors duration-100 outline-none shadow-2xs",
        disabled && "opacity-50 cursor-not-allowed",
        !disabled && "cursor-pointer",
        isCheckedOrIndeterminate
          ? "bg-foreground border-foreground text-background"
          : "bg-transparent border-border/80 hover:border-foreground/40 dark:border-white/25 dark:hover:border-white/45",
        className
      )}
    >
      <AnimatePresence initial={false}>
        {isCheckedOrIndeterminate && (
          <motion.svg
            key={indeterminate ? "indeterminate" : "checked"}
            width={12}
            height={12}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none stroke-current"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.05 } }}
            transition={{
              scale: { type: "spring", stiffness: 500, damping: 28 },
              opacity: { duration: 0.08 },
            }}
          >
            {indeterminate ? (
              <motion.path
                d="M3.5 8h9"
                initial={{ pathLength: 0 }}
                animate={{
                  pathLength: 1,
                  transition: { duration: 0.1, ease: "easeOut" },
                }}
                exit={{
                  pathLength: 0,
                  transition: { duration: 0.04, ease: "easeIn" },
                }}
              />
            ) : (
              <motion.path
                d="M3.5 8.5L6.5 11.5L12.5 4.5"
                initial={{ pathLength: 0 }}
                animate={{
                  pathLength: 1,
                  transition: { duration: 0.12, ease: "easeOut" },
                }}
                exit={{
                  pathLength: 0,
                  transition: { duration: 0.04, ease: "easeIn" },
                }}
              />
            )}
          </motion.svg>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
