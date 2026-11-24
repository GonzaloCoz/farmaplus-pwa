import { useState, useCallback } from "react";

/**
 * A reactive hook for clipboard operations with temporary state management.
 * Inspired by Coss UI / Base UI patterns.
 */
export function useCopyToClipboard(timeout = 2000) {
  const [isCopied, setIsCopied] = useState(false);

  const copy = useCallback(
    async (text: string) => {
      if (!text) return false;

      try {
        await navigator.clipboard.writeText(text);
        setIsCopied(true);

        setTimeout(() => {
          setIsCopied(false);
        }, timeout);

        return true;
      } catch (error) {
        console.error("Failed to copy to clipboard:", error);
        setIsCopied(false);
        return false;
      }
    },
    [timeout]
  );

  return { isCopied, copy };
}
