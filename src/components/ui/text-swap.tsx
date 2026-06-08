import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface TextSwapProps extends React.HTMLAttributes<HTMLSpanElement> {
  text: string;
}

export function TextSwap({ text, className, ...props }: TextSwapProps) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const [displayText, setDisplayText] = useState(text);

  useEffect(() => {
    if (text === displayText) return;

    const el = spanRef.current;
    if (!el) {
      setDisplayText(text);
      return;
    }

    // 1. Add .is-exit -> text slides up + blurs + fades
    el.classList.add("is-exit");

    // 2. After text-swap-dur (150ms): change textContent, add .is-enter-start
    const timeout = setTimeout(() => {
      setDisplayText(text);
      el.classList.add("is-enter-start");

      // Force reflow
      void el.offsetHeight;

      // 3. Remove .is-enter-start and .is-exit so new text animates back to 0
      el.classList.remove("is-exit", "is-enter-start");
    }, 150);

    return () => clearTimeout(timeout);
  }, [text, displayText]);

  return (
    <span ref={spanRef} className={cn("t-text-swap", className)} {...props}>
      {displayText}
    </span>
  );
}
