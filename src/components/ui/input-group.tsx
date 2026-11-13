"use client";

import {
  useRef,
  useState,
  useEffect,
  useMemo,
  createContext,
  useContext,
  forwardRef,
  Children,
  type ReactNode,
  type HTMLAttributes,
  type InputHTMLAttributes,
} from "react";
import { Field } from "@base-ui/react/field";
import type { IconComponent } from "@/lib/icon-context";
import { cn } from "@/lib/utils";
import { fontWeights } from "@/lib/font-weight";
import { useShape } from "@/lib/shape-context";
import { useFluidHover, useRegisterFluidHoverItem } from "@/hooks/use-fluid-hover";

interface InputGroupContextValue {
  registerItem: (index: number, element: HTMLElement | null) => void;
  activeIndex: number | null;
}

const InputGroupContext = createContext<InputGroupContextValue | null>(null);

function useInputGroup() {
  const ctx = useContext(InputGroupContext);
  if (!ctx)
    throw new Error("useInputGroup must be used within an InputGroup");
  return ctx;
}

interface InputGroupProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

const InputGroup = forwardRef<HTMLDivElement, InputGroupProps>(
  ({ children, className, ...props }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);

    // Check if any child is InputGroupInput (which indicates old horizontal layout usage)
    const isHorizontal = Children.toArray(children).some(
      (child: any) => child?.type?.displayName === "InputGroupInput"
    );

    const { activeIndex, handlers, registerItem } =
      useFluidHover(containerRef);

    const contextValue = useMemo(
      () => ({ registerItem, activeIndex }),
      [registerItem, activeIndex]
    );

    if (isHorizontal) {
      return (
        <div
          ref={ref}
          className={cn(
            "relative flex items-stretch border border-border bg-background shadow-xs",
            className
          )}
          {...props}
        >
          {children}
        </div>
      );
    }

    return (
      <InputGroupContext.Provider value={contextValue}>
        <div
          ref={(node) => {
            (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
          }}
          onMouseEnter={handlers.onMouseEnter}
          onMouseMove={handlers.onMouseMove}
          onMouseLeave={handlers.onMouseLeave}
          // `relative` makes this div the fields' offsetParent — the proximity
          // hook measures items via offsetTop and compares against
          // container-relative mouse coords, so the two coordinate spaces must
          // share this origin (same as every other proximity consumer).
          className={cn("relative flex flex-col gap-3 w-80 max-w-full", className)}
          {...props}
        >
          {children}
        </div>
      </InputGroupContext.Provider>
    );
  }
);

InputGroup.displayName = "InputGroup";

interface InputFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "index" | "size"> {
  label?: string;
  description?: string;
  placeholder?: string;
  icon?: IconComponent;
  index: number;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  alwaysShowBorder?: boolean;
  className?: string;
  inputClassName?: string;
  size?: "default" | "compact";
  endAdornment?: ReactNode;
}

const InputField = forwardRef<HTMLDivElement, InputFieldProps>(
  (
    {
      label,
      description,
      placeholder,
      icon: Icon,
      index,
      value,
      onChange,
      error,
      disabled,
      alwaysShowBorder,
      className,
      inputClassName,
      size = "default",
      endAdornment,
      ...props
    },
    ref
  ) => {
    const internalRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLElement | null>(null);
    const { registerItem, activeIndex } = useInputGroup();
    const [isFocused, setIsFocused] = useState(false);
    const shape = useShape();

    useRegisterFluidHoverItem(registerItem, index, internalRef);

    const isActive = activeIndex === index;
    const labelActive = isActive || isFocused;

    const handleFocus = () => {
      setIsFocused(true);
    };

    const handleBlur = () => {
      setIsFocused(false);
    };

    // The ring never moves at rest, like the Select trigger's border. Focus
    // darkens it to a neutral 40% and wins over the error tint while the
    // value is being fixed; hover only adds the fill.
    const ringClass = isFocused && !disabled
      ? "ring-foreground/40"
      : error
        ? "ring-destructive/50"
        : "ring-border";
    const bgClass = isActive && !isFocused && !disabled ? "bg-hover" : "bg-transparent";

    return (
      // Base UI Field wires the accessibility plumbing: Field.Label's htmlFor
      // targets the control, Field.Error's generated id lands in the control's
      // aria-describedby, and `invalid` drives aria-invalid / data-invalid.
      <Field.Root
        ref={(node) => {
          (internalRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        invalid={!!error}
        disabled={disabled}
        className={cn(
          "flex flex-col gap-1 cursor-text",
          disabled && "opacity-50 pointer-events-none",
          className
        )}
      >
        {/* Label */}
        {label && (
          <Field.Label className="inline-grid text-[length:var(--fs-body,13px)] leading-[var(--lh-body,20px)]">
            <span
              className="col-start-1 row-start-1 invisible"
              style={{ fontVariationSettings: fontWeights.semibold }}
              aria-hidden="true"
            >
              {label}
            </span>
            <span
              className={cn(
                "col-start-1 row-start-1",
                error ? "text-destructive" : "text-muted-foreground"
              )}
              style={{
                fontVariationSettings: fontWeights.normal,
              }}
            >
              {label}
            </span>
          </Field.Label>
        )}

        {/* Input container */}
        <div
          onMouseDown={(e) => {
            // The old wrapper was one big <label>, so a click anywhere (icon,
            // padding) focused the input. Keep that, without disturbing the
            // input's own caret placement.
            if (e.target === inputRef.current) return;
            if ((e.target as HTMLElement)?.closest("button")) return;
            e.preventDefault();
            inputRef.current?.focus();
          }}
          className={cn(
            `flex items-center gap-2 ${shape.input} ring-1 ring-inset transition-[color,background-color,border-radius,box-shadow] duration-80`,
            size === "compact" ? "h-7 px-2.5 gap-1.5 text-xs" : "h-9 px-3",
            bgClass,
            ringClass,
            inputClassName
          )}
        >
          {Icon && (
            <Icon
              size={size === "compact" ? 14 : 16}
              strokeWidth={labelActive || alwaysShowBorder ? 2 : 1.5}
              className={cn(
                "shrink-0 transition-[color,stroke-width] duration-80",
                labelActive || alwaysShowBorder
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            />
          )}
          <Field.Control
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            className={cn(
              "w-full rounded-none bg-transparent text-[length:var(--fs-body,13px)] leading-[var(--lh-body,20px)] pointer-coarse:text-[16px] text-foreground placeholder:text-muted-foreground outline-none font-[inherit]",
              size === "compact" && "text-xs"
            )}
            style={{ fontVariationSettings: fontWeights.normal }}
            {...props}
          />
          {endAdornment && (
            <div className="shrink-0 flex items-center">
              {endAdornment}
            </div>
          )}
        </div>

        {/* Optional description */}
        {description && !error && (
          <Field.Description
            className="text-[length:var(--fs-caption,12px)] leading-[var(--lh-caption,16px)] text-pretty text-muted-foreground"
            style={{ fontVariationSettings: fontWeights.normal }}
          >
            {description}
          </Field.Description>
        )}

        {/* Error message — `match` pins it visible while our controlled
            `error` prop is standing. */}
        {error && (
          <Field.Error
            match
            className="text-[length:var(--fs-caption,12px)] leading-[var(--lh-caption,16px)] text-destructive"
            style={{ fontVariationSettings: fontWeights.normal }}
          >
            {error}
          </Field.Error>
        )}
      </Field.Root>
    );
  }
);

InputField.displayName = "InputField";

const InputGroupAddon = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & { align?: "inline-start" | "inline-end" }
>(({ className, align, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center justify-center px-3 text-muted-foreground",
      className
    )}
    {...props}
  />
));
InputGroupAddon.displayName = "InputGroupAddon";

const InputGroupInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex-1 min-w-0 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground outline-none border-none ring-0 focus:ring-0 focus:border-none",
      className
    )}
    {...props}
  />
));
InputGroupInput.displayName = "InputGroupInput";

export { InputGroup, InputField, InputGroupAddon, InputGroupInput };
export default InputGroup;
