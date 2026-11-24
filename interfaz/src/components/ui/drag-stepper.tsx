import React, { useEffect, useRef, useState, useCallback } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

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
  defaultValue = 1,
  onChange,
  min = 1,
  max = 99999,
  step = 1,
  size = "compact",
  className,
  disabled = false,
}: DragStepperProps = {}) {
  const isControlled = value !== undefined;
  const [internalVal, setInternalVal] = useState(defaultValue);
  const v = isControlled ? (value as number) : internalVal;

  const [isManualInput, setIsManualInput] = useState(false);
  const [tempInput, setTempInput] = useState(String(v));

  const inputRef = useRef<HTMLInputElement | null>(null);
  const repeatTimer = useRef<any>(null);
  const repeatInterval = useRef<any>(null);

  const tempInputRef = useRef(tempInput);
  tempInputRef.current = tempInput;
  const isManualRef = useRef(isManualInput);
  isManualRef.current = isManualInput;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const minRef = useRef(min);
  minRef.current = min;
  const maxRef = useRef(max);
  maxRef.current = max;

  // Sincronizar tempInput cuando el prop value cambia externamente (solo si no está escribiendo activamente)
  useEffect(() => {
    if (!isManualInput) {
      setTempInput(String(v));
      tempInputRef.current = String(v);
    }
  }, [v, isManualInput]);

  useEffect(() => {
    if (isManualInput && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isManualInput]);

  const updateVal = useCallback((newVal: number) => {
    const clamped = clamp(newVal, min, max);
    if (!isControlled) {
      setInternalVal(clamped);
    }
    onChange?.(clamped);
  }, [min, max, isControlled, onChange]);

  // Si el componente se desmonta mientras el usuario estaba editando (ej: apagó el switch 'Editar')
  useEffect(() => {
    return () => {
      clearTimeout(repeatTimer.current);
      clearInterval(repeatInterval.current);
      if (isManualRef.current) {
        isManualRef.current = false;
        const raw = (inputRef.current?.value ?? tempInputRef.current).trim();
        if (raw !== "") {
          const parsed = parseInt(raw, 10);
          if (!isNaN(parsed)) {
            onChangeRef.current?.(clamp(parsed, minRef.current, maxRef.current));
          }
        }
      }
    };
  }, []);

  const handleCommitManualInput = () => {
    if (!isManualInput) return;
    setIsManualInput(false);
    isManualRef.current = false;
    const raw = (inputRef.current?.value ?? tempInputRef.current).trim();
    if (raw === "") {
      // Si el usuario borró todo y salió, restauramos el valor original en lugar de forzar a 1
      setTempInput(String(v));
      tempInputRef.current = String(v);
      return;
    }
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed)) {
      setTempInput(String(v));
      tempInputRef.current = String(v);
      return;
    }
    updateVal(parsed);
  };

  const handleStartManualEdit = (e: React.MouseEvent) => {
    if (disabled) return;
    e.stopPropagation();
    setIsManualInput(true);
    isManualRef.current = true;
    setTempInput(String(v));
    tempInputRef.current = String(v);
  };

  // Manejo de botones +/- con click inmediato y soporte de repetición al mantener presionado
  const startStep = (dir: 1 | -1) => (e: React.PointerEvent) => {
    if (disabled) return;
    e.stopPropagation();

    let baseVal = v;
    if (isManualInput) {
      setIsManualInput(false);
      isManualRef.current = false;
      const raw = (inputRef.current?.value ?? tempInputRef.current).trim();
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed)) {
        baseVal = clamp(parsed, min, max);
      }
    }

    // Paso inmediato
    const nextVal = clamp(baseVal + dir * step, min, max);
    updateVal(nextVal);

    // Repetición continua si mantiene presionado más de 350ms
    clearTimeout(repeatTimer.current);
    clearInterval(repeatInterval.current);

    let currentVal = nextVal;
    repeatTimer.current = setTimeout(() => {
      repeatInterval.current = setInterval(() => {
        currentVal = clamp(currentVal + dir * step, min, max);
        updateVal(currentVal);
      }, 90);
    }, 350);
  };

  const stopStep = (e: React.PointerEvent) => {
    e.stopPropagation();
    clearTimeout(repeatTimer.current);
    clearInterval(repeatInterval.current);
  };

  const isCompact = size === "compact" || size === "sm";

  return (
    <div
      className={cn(isCompact ? "step-well-compact" : "step-well", className)}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={cn("step-pill gpane", isCompact && "step-pill-compact")}>
        <button
          type="button"
          className="step-side cursor-pointer"
          onPointerDown={startStep(-1)}
          onPointerUp={stopStep}
          onPointerLeave={stopStep}
          onPointerCancel={stopStep}
          disabled={disabled || v <= min}
          aria-label="Disminuir"
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
                tempInputRef.current = text;
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
              isCompact ? "text-xs min-w-[28px] max-w-[64px]" : "text-base min-w-[48px]"
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
          className="step-side cursor-pointer"
          onPointerDown={startStep(1)}
          onPointerUp={stopStep}
          onPointerLeave={stopStep}
          onPointerCancel={stopStep}
          disabled={disabled || v >= max}
          aria-label="Aumentar"
        >
          <Plus size={isCompact ? 12 : 16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

export const DragStepper = Stepper;
