"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface GradientButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const GradientButton = React.forwardRef<
  HTMLButtonElement,
  GradientButtonProps
>(({ className, children, disabled, ...props }, ref) => {
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const combinedRef = React.useCallback(
    (node: HTMLButtonElement | null) => {
      (buttonRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
    },
    [ref],
  );

  const handlePointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const btn = buttonRef.current;
      if (!btn) return;
      const bounds = btn.getBoundingClientRect();
      btn.style.setProperty("--rx", String((e.clientX - bounds.x) / bounds.width));
      btn.style.setProperty("--x", String((e.clientX - bounds.x) / bounds.width));
      btn.style.setProperty("--y", String((e.clientY - bounds.y) / bounds.height));
    },
    [],
  );

  return (
    <button
      ref={combinedRef}
      className={cn("control", className)}
      onPointerMove={handlePointerMove}
      disabled={disabled}
      type="button"
      {...props}
    >
      <span className="backdrop" />
      <span className="text">{children}</span>
    </button>
  );
});

GradientButton.displayName = "GradientButton";
