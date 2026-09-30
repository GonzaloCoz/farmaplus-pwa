"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

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
          : "bg-surface-3 border-border/70 hover:border-foreground/40 dark:border-white/20 dark:hover:border-white/40",
        className
      )}
    >
      {/* Animación del checkmark / indeterminate */}
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

