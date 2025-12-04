import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface SegmentOption {
    value: string;
    label: string;
    icon?: React.ReactNode;
    disabled?: boolean;
}

interface SegmentedButtonProps {
    options: SegmentOption[];
    value: string | string[];
    onChange: (value: string | string[]) => void;
    multiSelect?: boolean;
    density?: "default" | "compact";
    className?: string;
}

export function SegmentedButton({
    options,
    value,
    onChange,
    multiSelect = false,
    density = "default",
    className,
}: SegmentedButtonProps) {
    const isSelected = (optionValue: string) => {
        if (Array.isArray(value)) {
            return value.includes(optionValue);
        }
        return value === optionValue;
    };

    const handleClick = (optionValue: string) => {
        if (multiSelect) {
            const currentValues = Array.isArray(value) ? value : [value];
            if (currentValues.includes(optionValue)) {
                onChange(currentValues.filter((v) => v !== optionValue));
            } else {
                onChange([...currentValues, optionValue]);
            }
        } else {
            onChange(optionValue);
        }
    };

    const paddingClass = density === "compact" ? "px-3 py-1.5" : "px-4 py-2.5";

    return (
        <div
            className={cn(
                "inline-flex border border-border rounded-lg overflow-hidden elevation-1",
                className
            )}
        >
            {options.map((option, index) => {
                const selected = isSelected(option.value);
                return (
                    <motion.button
                        key={option.value}
                        onClick={() => !option.disabled && handleClick(option.value)}
                        disabled={option.disabled}
                        whileHover={!option.disabled ? { backgroundColor: "rgba(0,0,0,0.05)" } : {}}
                        whileTap={!option.disabled ? { scale: 0.98 } : {}}
                        className={cn(
                            "relative flex items-center justify-center gap-2 text-label-large font-medium transition-colors",
                            paddingClass,
                            selected
                                ? "bg-secondary text-secondary-foreground"
                                : "bg-background text-foreground",
                            option.disabled && "opacity-50 cursor-not-allowed",
                            index > 0 && "border-l border-border"
                        )}
                    >
                        {option.icon && (
                            <span className="w-4 h-4 flex-shrink-0">{option.icon}</span>
                        )}
                        <span>{option.label}</span>
                        {multiSelect && selected && (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0 }}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            >
                                <Check className="w-4 h-4" />
                            </motion.div>
                        )}
                        {selected && (
                            <motion.div
                                layoutId="segmented-button-indicator"
                                className="absolute inset-0 bg-secondary -z-10"
                                transition={{ type: "spring", stiffness: 500, damping: 40 }}
                            />
                        )}
                    </motion.button>
                );
            })}
        </div>
    );
}
