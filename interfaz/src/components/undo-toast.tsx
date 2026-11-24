"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { KeyCaps } from "@/lib/key-cap";
import { fontWeights } from "@/lib/font-weight";
import { useShape } from "@/lib/shape-context";
import { typeClass, useSize } from "@/lib/size-context";
import { spring } from "@/lib/springs";
import { useIsMac } from "@/components/ui/command-menu";

type ToastState = { id: number; message: string; onUndo: () => void } | null;
type Listener = (next: ToastState) => void;

const listeners = new Set<Listener>();
let currentToast: ToastState = null;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;
let nextId = 1;

function emit(next: ToastState) {
  currentToast = next;
  listeners.forEach((fn) => fn(next));
}

export function showUndoToast(message: string, onUndo: () => void) {
  if (dismissTimer) clearTimeout(dismissTimer);
  const id = nextId++;
  emit({ id, message, onUndo });
  dismissTimer = setTimeout(() => {
    if (currentToast?.id === id) emit(null);
  }, 6000);
}

export function UndoToaster() {
  const [item, setItem] = useState<ToastState>(currentToast);
  const shape = useShape();
  const size = useSize();
  const mac = useIsMac();

  useEffect(() => {
    listeners.add(setItem);
    return () => {
      listeners.delete(setItem);
    };
  }, []);

  const handleUndo = () => {
    if (!item) return;
    if (dismissTimer) clearTimeout(dismissTimer);
    const fn = item.onUndo;
    emit(null);
    fn();
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
      <AnimatePresence mode="wait">
        {item && (
          <motion.div
            key={item.id}
            role="status"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={spring.fast}
            className={cn(
              "pointer-events-auto mx-auto flex h-9 w-max items-center gap-3 bg-foreground pl-3 pr-1 text-background shadow-lg",
              typeClass("body", size.variant),
              shape.bg
            )}
            style={{ fontVariationSettings: fontWeights.normal }}
          >
            <span className="[text-box:trim-both_cap_alphabetic]">{item.message}</span>
            <button
              type="button"
              onClick={handleUndo}
              className={cn(
                "inline-flex h-7 cursor-pointer items-center gap-1.5 px-2 text-background outline-none transition-colors duration-80 hover:bg-background/15 focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]",
                shape.input
              )}
              style={{ fontVariationSettings: fontWeights.semibold }}
            >
              Deshacer
              <KeyCaps keys={mac ? ["⌘", "Z"] : ["Ctrl", "Z"]} tone="inverted" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
