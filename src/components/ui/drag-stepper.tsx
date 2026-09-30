import React, { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/* Pointer capture is best effort and must never be the thing
   that decides whether the rest of a handler runs. It throws
   for a pointer id the element does not own, and anything
   sequenced after it is then silently skipped. Arm state
   first, capture last, and swallow the failure. */
const grab = (e: React.PointerEvent) => {
  try {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  } catch {
    /* the gesture still works through ordinary bubbling */
  }
};

/* ══ 3 · stepper that becomes a slider ════════════════════
   Tap for one, hold to sweep. A stepper is precise and slow;
   a slider is fast and vague. Almost every product picks one
   and makes the other job painful. This is both, on the same
   control, chosen by how long you hold it — so the coarse
   move never costs you the fine one. */

const WAKE = 260;      // hold this long and the rail appears

/* 23 is half of the 46px pill, so the default is the shape it
   already is and the slider only runs downwards from it. */
const STEP_CORNER = 23;

export interface DragStepperProps {
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  corner?: number;
  size?: "default" | "compact" | "sm";
  className?: string;
  disabled?: boolean;
}

export function Stepper({
  value,
  defaultValue = 24,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  corner = STEP_CORNER,
  size = "default",
  className,
  disabled = false,
}: DragStepperProps = {}) {
  const isControlled = value !== undefined;
  const [internalVal, setInternalVal] = useState(defaultValue);
  const v = isControlled ? (value as number) : internalVal;

  const [sweeping, setSweeping] = useState(false);
  /* which end is under the finger — that edge sinks a touch */
  const [held, setHeld] = useState<-1 | 0 | 1>(0);
  const [isManualInput, setIsManualInput] = useState(false);
  const [tempInput, setTempInput] = useState(String(v));

  const rail = useRef<HTMLDivElement | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const from = useRef({ x: 0, v: 0, dir: 1, stepped: false });
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!isManualInput) {
      setTempInput(String(v));
    }
  }, [v, isManualInput]);

  useEffect(() => {
    if (isManualInput && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isManualInput]);

  const updateVal = (newVal: number) => {
    const clamped = clamp(newVal, min, max);
    if (!isControlled) {
      setInternalVal(clamped);
    }
    onChange?.(clamped);
  };

  const press = (dir: 1 | -1) => (e: React.PointerEvent) => {
    if (disabled || isManualInput) return;
    e.stopPropagation();
    from.current = { x: e.clientX, v, dir, stepped: false };
    setHeld(dir);
    timer.current = window.setTimeout(() => { setSweeping(true); }, WAKE);
    grab(e);
  };

  const drag = (e: React.PointerEvent) => {
    if (!sweeping || disabled) return;
    const w = rail.current?.offsetWidth ?? (size === "compact" ? 100 : 200);
    /* the whole rail spans 100 or max-min, so the sweep is proportional
       to how wide the control actually is */
    const span = Math.max(1, max - min);
    const next = clamp(Math.round(from.current.v + ((e.clientX - from.current.x) / w) * span), min, max);
    /* a sweep is the one gesture here that produces a
       continuous value, so it gets the continuous voice —
       pitched to where it has got to, and floored so a fast
       drag across the rail is a rise and not a rattle */
    updateVal(next);
  };

  const lift = () => {
    window.clearTimeout(timer.current);
    setHeld(0);
    if (!sweeping && !from.current.stepped && !disabled) {
      from.current.stepped = true;
      updateVal(v + from.current.dir * step);
    }
    setSweeping(false);
  };

  const handleStartManualEdit = (e: React.MouseEvent) => {
    if (disabled) return;
    e.stopPropagation();
    setIsManualInput(true);
    setTempInput(String(v));
  };

  const handleCommitManualInput = () => {
    setIsManualInput(false);
    if (tempInput.trim() === "") {
      updateVal(min);
      return;
    }
    const parsed = parseInt(tempInput, 10);
    if (isNaN(parsed)) {
      setTempInput(String(v));
      return;
    }
    updateVal(parsed);
  };

  const fillRatio = Math.max(0, Math.min(1, (v - min) / Math.max(1, max - min)));
  const isCompact = size === "compact" || size === "sm";

  return (
    <div
      className={cn(isCompact ? "step-well-compact" : "step-well", className)}
      style={{ "--step-r": `${clamp(corner, 0, STEP_CORNER)}px` } as React.CSSProperties}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={cn("step-pill gpane", isCompact && "step-pill-compact")}
        data-sweep={sweeping}
        /* a press sinks its own end; a sweep takes over from it */
        data-press={!sweeping && held ? (held < 0 ? "l" : "r") : undefined}
        ref={rail}
      >
        <button
          type="button"
          className="step-side"
          onPointerDown={press(-1)}
          onPointerMove={drag}
          onPointerUp={lift}
          onPointerCancel={lift}
          disabled={disabled || v <= min}
          aria-label="Down"
        >
          <Minus size={isCompact ? 12 : 16} strokeWidth={2} />
        </button>

        {isManualInput ? (
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={tempInput}
            onChange={(e) => {
              const text = e.target.value;
              if (text === "" || /^\d+$/.test(text)) {
                setTempInput(text);
              }
            }}
            onBlur={handleCommitManualInput}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCommitManualInput();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setIsManualInput(false);
                setTempInput(String(v));
              }
            }}
            className={cn(
              "step-value font-sans text-center bg-transparent border-none outline-none font-semibold text-foreground p-0 m-0",
              isCompact ? "text-xs min-w-[28px] max-w-[36px]" : "text-base min-w-[48px]"
            )}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className={cn("step-value cursor-text select-none", isCompact && "text-xs min-w-[28px]")}
            onClick={handleStartManualEdit}
            title="Clic para ingresar número manualmente"
          >
            {v}
          </span>
        )}

        <button
          type="button"
          className="step-side"
          onPointerDown={press(1)}
          onPointerMove={drag}
          onPointerUp={lift}
          onPointerCancel={lift}
          disabled={disabled || v >= max}
          aria-label="Up"
        >
          <Plus size={isCompact ? 12 : 16} strokeWidth={2} />
        </button>

        <i className="step-fill" style={{ transform: `scaleX(${fillRatio})` }} />
      </div>
      {/* ── no caption ───────────────────────────────────────
          There was a line of small caps under the pill that
          read "sweeping" while you held it, and it was doing
          two unhelpful things at once. It said in a word what
          the control was already showing you — the pill widens,
          the rail fills, the number swells — and because it was
          a flex sibling of the pill, its arrival RESIZED the
          column and shoved the pill 5px up out from under your
          own finger, mid-gesture.

          A control that moves when you touch it is worse than
          one that says nothing. */}
    </div>
  );
}

export const DragStepper = Stepper;
