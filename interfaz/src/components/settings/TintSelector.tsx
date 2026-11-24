import React from "react";
import { cn } from "@/lib/utils";
import { useTint, AppTint, TINT_OPTIONS } from "@/hooks/useTint";

interface TintSelectorProps {
    className?: string;
}

export function TintSelector({ className }: TintSelectorProps) {
    const { tint: currentTint, setTint } = useTint();

    return (
        <div className={cn("grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3", className)}>
            {TINT_OPTIONS.map((option) => {
                const isSelected = currentTint === option.id;
                return (
                    <button
                        key={option.id}
                        type="button"
                        onClick={() => setTint(option.id)}
                        className={cn(
                            "group relative flex flex-col items-center gap-2.5 p-3 rounded-xl border transition-all duration-150 text-center cursor-pointer select-none",
                            isSelected
                                ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary"
                                : "border-border/60 hover:border-primary/40 hover:bg-hover/50"
                        )}
                        title={option.description}
                    >
                        {/* Circle preview with gradient and shadow */}
                        <div
                            className={cn(
                                "w-7 h-7 rounded-full flex items-center justify-center transition-transform duration-150 group-hover:scale-105 shadow-sm",
                                isSelected ? "ring-2 ring-offset-2 ring-primary ring-offset-background" : ""
                            )}
                            style={{
                                backgroundColor: option.color,
                            }}
                        >
                            {isSelected && (
                                <svg className="w-3.5 h-3.5 text-white drop-shadow-xs" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </div>

                        {/* Label */}
                        <div className="flex flex-col items-center">
                            <span
                                className={cn(
                                    "text-xs font-semibold tracking-tight",
                                    isSelected ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                                )}
                            >
                                {option.label}
                            </span>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
