"use client";

import React, { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { MotionConfig, motion } from "motion/react";
import { cn } from "@/lib/utils";

// OTP segmented input - N boxes, secretly ONE real input.
// Powered by Moumen Lab architecture with Farmaplus styling tokens.

const EASE = [0.22, 1, 0.36, 1] as const;
const SHAKE_S = 0.38; // wrong code: row shake
const DROP_S = 0.24; // each digit's fall-out
const STAGGER_S = 0.045; // per-digit clear offset
const FILL_S = 0.055; // per-cell success cascade offset

const DEFAULT_OTP_VARS = {
  "--otp-cell-w": "2.75rem",
  "--otp-cell-h": "3.2rem",
  "--otp-gap": "0.25rem",
} as CSSProperties;

export interface OtpInputState {
  length: number;
  caret: { start: number; end: number };
  state: "idle" | "success" | "error";
  attempts: number;
  focused: boolean;
}

export interface OtpInputProps {
  length?: number;
  code?: string;
  verify?: (value: string) => boolean | Promise<boolean>;
  mask?: boolean;
  group?: boolean;
  prefill?: { key: number; code: string } | null;
  inspect?: boolean;
  value?: string;
  onChange?: (val: string) => void;
  onStateChange?: (state: OtpInputState) => void;
  onSuccess?: (code: string) => void;
  className?: string;
  style?: CSSProperties;
}

export function OtpInput({
  length = 6,
  code = "123456",
  verify,
  mask = false,
  group = true,
  prefill = null,
  inspect = false,
  value: controlledValue,
  onChange,
  onStateChange,
  onSuccess,
  className,
  style,
}: OtpInputProps) {
  const [internalValue, setInternalValue] = useState("");
  const value = controlledValue !== undefined ? controlledValue : internalValue;

  const [sel, setSel] = useState({ start: 0, end: 0 });
  const [focused, setFocused] = useState(false);
  const [state, setState] = useState<"idle" | "success" | "error">("idle");
  const [attempts, setAttempts] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const errorTimerRef = useRef<number>(0);

  const chars = value.split("");
  const collapsed = sel.start === sel.end;
  const caretCell = Math.min(sel.start, length - 1);
  const groupAt = Math.ceil(length / 2);

  function syncSel() {
    const el = inputRef.current;
    if (!el) return;
    setSel({ start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 });
  }

  // Active cell is derived directly from native caret selection
  useEffect(() => {
    const onSelectionChange = () => {
      if (document.activeElement === inputRef.current) syncSel();
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (state !== "idle") return;
    const next = event.target.value.replace(/\D/g, "").slice(0, length);
    if (controlledValue === undefined) {
      setInternalValue(next);
    }
    onChange?.(next);
    requestAnimationFrame(syncSel);
  }

  function handleMouseDown(event: React.MouseEvent) {
    event.preventDefault();
    const el = inputRef.current;
    el?.focus({ preventScroll: true });
    el?.setSelectionRange(value.length, value.length);
    syncSel();
  }

  // Automatic verification when length matches
  useEffect(() => {
    if (state !== "idle" || value.length !== length) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      let ok: boolean;
      try {
        ok = await Promise.resolve(verify ? verify(value) : value === code);
      } catch {
        ok = false;
      }
      if (cancelled) return;
      setAttempts((n) => n + 1);
      if (ok) {
        setState("success");
        onSuccess?.(value);
      } else {
        setState("error");
        errorTimerRef.current = window.setTimeout(() => {
          if (controlledValue === undefined) {
            setInternalValue("");
          }
          onChange?.("");
          setState("idle");
          const el = inputRef.current;
          if (el && document.activeElement === el) {
            el.setSelectionRange(0, 0);
            syncSel();
          } else {
            setSel({ start: 0, end: 0 });
          }
        }, SHAKE_S * 1000 + length * STAGGER_S * 1000 + 260);
      }
    }, 320);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, state, code, verify, length, controlledValue, onChange, onSuccess]);

  useEffect(() => {
    if (!prefill) return;
    clearTimeout(errorTimerRef.current);
    setState("idle");
    const next = String(prefill.code).replace(/\D/g, "").slice(0, length);
    if (controlledValue === undefined) {
      setInternalValue(next);
    }
    onChange?.(next);
    setSel({ start: length, end: length });
  }, [prefill?.key]);

  function reset() {
    clearTimeout(errorTimerRef.current);
    if (controlledValue === undefined) {
      setInternalValue("");
    }
    onChange?.("");
    setState("idle");
    setAttempts(0);
    const el = inputRef.current;
    el?.focus({ preventScroll: true });
    el?.setSelectionRange(0, 0);
    syncSel();
  }

  useEffect(() => () => clearTimeout(errorTimerRef.current), []);

  useEffect(() => {
    onStateChange?.({
      length: value.length,
      caret: { start: sel.start, end: sel.end },
      state,
      attempts,
      focused,
    });
  }, [value.length, sel, state, attempts, focused, onStateChange]);

  const cells = useMemo(
    () =>
      Array.from({ length }, (_, index) => {
        const char = chars[index];
        return {
          index,
          char,
          active: focused && state === "idle" && collapsed && caretCell === index,
          selected: focused && !collapsed && index >= sel.start && index < sel.end,
        };
      }),
    [chars.join(""), length, focused, state, collapsed, caretCell, sel.start, sel.end]
  );

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn("relative flex flex-col items-center gap-2 select-none", className)}
        style={{ ...DEFAULT_OTP_VARS, ...style }}
        data-state={state}
      >
        {/* Row shake animation on wrong code */}
        <motion.div
          className="relative flex items-center gap-[var(--otp-gap)]"
          animate={state === "error" ? { x: [0, -6, 5, -4, 3, -1, 0] } : { x: 0 }}
          transition={{ duration: SHAKE_S, ease: EASE }}
        >
          {cells.map((cell) => (
            <div
              key={cell.index}
              className={cn(
                "flex items-center justify-center w-[var(--otp-cell-w)] h-[var(--otp-cell-h)] rounded-xl text-xl font-bold tabular-nums border transition-all duration-150",
                group && cell.index === groupAt ? "ml-1.5" : "",
                state === "success"
                  ? "border-foreground/50 bg-surface-3 text-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.1)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.15)]"
                  : cell.active
                    ? "bg-surface-3 text-foreground border-foreground/60 shadow-[0_0_0_1px_rgba(0,0,0,0.1)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.15)]"
                    : state === "error"
                      ? "bg-white dark:bg-surface-3 text-destructive border-destructive shadow-[0_0_0_2px_rgba(239,68,68,0.2)]"
                      : "bg-surface-2/70 dark:bg-surface-2/40 text-foreground border-border/50 hover:border-border",
                inspect && "outline outline-[1.5px] outline-dashed outline-blue-500 -outline-offset-2"
              )}
              style={state === "success" ? { transitionDelay: `${cell.index * FILL_S * 1000}ms` } : undefined}
              aria-hidden="true"
            >
              {cell.char && (
                <motion.span
                  className={cn(
                    "inline-block rounded-[4px] px-1 py-0.5 -mx-1 -my-0.5 transition-colors duration-150",
                    cell.selected ? "bg-foreground/15" : "bg-transparent"
                  )}
                  initial={false}
                  animate={
                    state === "success"
                      ? { scale: [1, 1.15, 1], y: 0, opacity: 1, filter: "blur(0px)" }
                      : state === "error"
                        ? { y: "0.5rem", opacity: 0, filter: "blur(2px)" }
                        : { scale: 1, y: 0, opacity: 1, filter: "blur(0px)" }
                  }
                  transition={
                    state === "success"
                      ? { duration: 0.3, ease: EASE, delay: cell.index * FILL_S }
                      : state === "error"
                        ? { duration: DROP_S, ease: "easeOut", delay: SHAKE_S + cell.index * STAGGER_S }
                        : { duration: 0 }
                  }
                >
                  {mask ? "•" : cell.char}
                </motion.span>
              )}
              {cell.active && !cell.char && (
                <motion.span
                  className="w-[2px] h-[1.35rem] rounded-[1px] bg-foreground"
                  animate={{ opacity: [1, 1, 0, 0] }}
                  transition={{ duration: 1.1, times: [0, 0.5, 0.5, 1], repeat: Infinity, ease: "linear" }}
                />
              )}
            </div>
          ))}

          {/* Stretched invisible native input */}
          <input
            ref={inputRef}
            className={cn(
              "absolute inset-0 w-full h-full border-0 outline-none bg-transparent font-mono text-xl cursor-text",
              "[letter-spacing:calc(var(--otp-cell-w)+var(--otp-gap)-1ch)] pl-[calc(var(--otp-cell-w)/2-0.5ch)]",
              "selection:bg-transparent! selection:text-transparent! [caret-color:transparent]",
              inspect
                ? "text-red-500/60 [-webkit-text-fill-color:rgba(239,68,68,0.6)] outline outline-dashed outline-red-400"
                : "text-transparent [-webkit-text-fill-color:transparent]"
            )}
            type="text"
            value={value}
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label={`${length}-digit verification code`}
            spellCheck={false}
            autoCorrect="off"
            readOnly={state !== "idle"}
            onChange={handleChange}
            onMouseDown={handleMouseDown}
            onKeyUp={syncSel}
            onFocus={() => {
              setFocused(true);
              const el = inputRef.current;
              el?.setSelectionRange(value.length, value.length);
              syncSel();
            }}
            onBlur={() => setFocused(false)}
          />
        </motion.div>

        {/* State feedback message & Reset button */}
        <div className="flex items-center gap-2.5 min-h-7">
          <span
            className={cn(
              "text-xs transition-colors duration-150 tracking-tight",
              state === "success"
                ? "text-foreground font-semibold"
                : state === "error"
                  ? "text-destructive font-semibold"
                  : "text-muted-foreground/70 font-medium"
            )}
          >
            {state === "success"
              ? "Código verificado correctamente"
              : state === "error"
                ? "Código incorrecto. Vuelva a intentar."
                : mask
                  ? "Dígitos ocultos por seguridad"
                  : " "}
          </span>

          {state === "success" && (
            <motion.button
              type="button"
              className="h-6 px-2 rounded-md bg-surface-2 dark:bg-surface-3 text-foreground text-[11px] font-semibold cursor-pointer transition-all duration-150 hover:bg-foreground/10 active:scale-95 border border-border/50"
              onClick={reset}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            >
              Reintentar
            </motion.button>
          )}
        </div>

        <span className="sr-only" aria-live="polite">
          {state === "success"
            ? "Código verificado."
            : state === "error"
              ? "Código incorrecto, el campo se reiniciará."
              : ""}
        </span>
      </div>
    </MotionConfig>
  );
}

export default OtpInput;
