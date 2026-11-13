import { useState } from "react";
import { cn } from "@/lib/utils";
import { CounterAnimation } from "./CounterAnimation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { DotsHorizontal, FileSearch02 } from '@untitledui/icons';
import {
    DropdownMenu,
    DropdownTrigger,
    DropdownContent,
    MenuItem,
} from "@/components/ui/dropdown";
import { notify } from "@/lib/notifications";
import { fontWeights } from "@/lib/font-weight";
import { getLaboratoryLogoUrl } from "@/lib/laboratoryLogos";

export type LaboratoryStatus = "controlado" | "por_controlar" | "pendiente";

function getLaboratoryInitials(name: string): string {
    const words = name
        .trim()
        .split(/\s+/)
        .map((w) => w.replace(/^[^a-zA-Z0-9ÁÉÍÓÚÑáéíóúñ]+/, ""))
        .filter(Boolean);

    if (words.length === 0) return "";
    if (words.length === 1) {
        return words[0].slice(0, 2).toUpperCase();
    }
    return (words[0][0] + words[1][0]).toUpperCase();
}

interface LaboratoryCardProps {
    name: string;
    negativeValue: number;
    positiveValue: number;
    differenceValue: number;
    status: LaboratoryStatus;
    progress?: number;
    onClick?: () => void;
    onMouseEnter?: () => void;
    className?: string;
    onRequestRemoval?: (labName: string) => void;
    disabled?: boolean;
    isDischarged?: boolean;
    hasPendingRemoval?: boolean;
    pendingRemovalReason?: string;
}

export function LaboratoryCard({
    name,
    negativeValue,
    positiveValue,
    differenceValue,
    status,
    progress = 0,
    onClick,
    onMouseEnter,
    className,
    onRequestRemoval,
    disabled,
    isDischarged,
    hasPendingRemoval = false,
    pendingRemovalReason,
}: LaboratoryCardProps) {
    const isInactive = disabled || isDischarged;
    const displayProgress = progress || 0;

    const totalAdjusted = positiveValue + Math.abs(negativeValue);
    let sobrantePct = 0;
    let faltantePct = 0;

    if (totalAdjusted > 0) {
        sobrantePct = Math.round((positiveValue / totalAdjusted) * 100);
        faltantePct = Math.round((Math.abs(negativeValue) / totalAdjusted) * 100);
        // Ajuste de precisión para que sumen 100%
        if (sobrantePct + faltantePct !== 100) {
            faltantePct = 100 - sobrantePct;
        }
    }

    const greenBarPct = totalAdjusted > 0 ? sobrantePct : displayProgress;
    const orangeBarPct = totalAdjusted > 0 ? faltantePct : 0;

    const cleanName = name ? name.replace(/[\r\n]+/g, ' ').trim() : '';
    const logoUrl = getLaboratoryLogoUrl(cleanName);
    const initials = getLaboratoryInitials(cleanName);
    const [imgError, setImgError] = useState(false);
    const showLogo = Boolean(logoUrl && !imgError);
    const hasActivity = totalAdjusted > 0 || displayProgress > 0;

    return (
        <div
            role="button"
            tabIndex={isInactive ? -1 : 0}
            aria-disabled={isInactive || undefined}
            aria-label={`${cleanName}, avance ${displayProgress}%`}
            className={cn(
                "group bg-muted border border-border/40 rounded-2xl p-[2px] transition-[transform,box-shadow,border-color,background-color,opacity] duration-150 ease-out flex flex-col justify-between shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]",
                isInactive 
                    ? "opacity-55 grayscale-[25%] bg-muted/15 border-dashed border-border/60 hover:border-border/60 hover:shadow-none cursor-not-allowed select-none" 
                    : hasPendingRemoval
                    ? "cursor-pointer active:scale-[0.98] card-pending-removal"
                    : "cursor-pointer active:scale-[0.98] hover:border-border/80 hover:shadow-md",
                className
            )}
            onClick={isInactive ? (e) => { e.preventDefault(); e.stopPropagation(); } : onClick}
            onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (!isInactive) onClick?.();
                }
            }}
            onMouseEnter={isInactive ? undefined : onMouseEnter}
        >
            {/* Barra Superior (en el recuadro contenedor externo) */}
            <div className="px-3 py-2 flex items-center justify-between gap-3 min-h-10">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div
                        className="h-7 w-7 rounded-lg border border-border/60 bg-surface-3 dark:bg-surface-3 text-muted-foreground flex items-center justify-center shrink-0 overflow-hidden"
                        aria-hidden="true"
                    >
                        {showLogo ? (
                            <img
                                src={logoUrl!}
                                alt=""
                                loading="lazy"
                                onError={() => setImgError(true)}
                                className="size-full object-cover rounded-[7px] outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
                            />
                        ) : (
                            <span
                                className="text-[10px] leading-none font-semibold tracking-[0.02em] text-muted-foreground uppercase select-none"
                                style={{ fontVariationSettings: fontWeights.semibold }}
                            >
                                {initials}
                            </span>
                        )}
                    </div>
                    <h3
                        className={cn(
                            "font-normal text-[13px] tracking-tight truncate flex-1 min-w-0 transition-colors whitespace-nowrap [text-wrap:nowrap]",
                            isInactive ? "text-muted-foreground/70 line-through" : "text-foreground"
                        )}
                        style={{ fontVariationSettings: fontWeights.normal }}
                        title={cleanName}
                    >
                        {cleanName}
                    </h3>
                </div>
                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {isInactive ? (
                        <Badge
                            variant="outline"
                            color="rose"
                            size="sm"
                            className="shrink-0 font-semibold border-rose-500/30 text-rose-500 bg-rose-500/10 text-[10px] uppercase"
                        >
                            Baja Aprobada
                        </Badge>
                    ) : (
                        <>
                            {hasPendingRemoval && (
                                <Tooltip
                                    content={
                                        <div className="flex flex-col gap-0.5 text-left max-w-[240px] py-0.5">
                                            <span className="font-semibold text-background">Solicitud de baja en trámite</span>
                                            <span className="text-[11px] opacity-85 leading-snug">
                                                {pendingRemovalReason
                                                    ? `Motivo: ${pendingRemovalReason}`
                                                    : "Se solicitó la baja de este laboratorio. Pendiente de aprobación administrativa."}
                                            </span>
                                        </div>
                                    }
                                    side="top"
                                    sideOffset={6}
                                >
                                    <Badge
                                        variant="solid"
                                        size="sm"
                                        color="blue"
                                        className="shrink-0 cursor-help"
                                    >
                                        Baja solicitada
                                    </Badge>
                                </Tooltip>
                            )}

                            <span
                                className={cn(
                                    "shrink-0 font-semibold text-[13px] tracking-tight tabular-nums whitespace-nowrap transition-colors",
                                    hasActivity ? "text-foreground" : "text-muted-foreground"
                                )}
                                style={{ fontVariationSettings: fontWeights.semibold }}
                            >
                                {displayProgress}%
                            </span>
                        </>
                    )}

                    {onRequestRemoval && !isInactive && (
                        <DropdownMenu>
                            <DropdownTrigger render={
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors shrink-0"
                                    title="Opciones"
                                    aria-label={`Opciones de ${cleanName}`}
                                >
                                    <DotsHorizontal className="size-4" />
                                </Button>
                            } />
                            <DropdownContent align="end" className="w-auto min-w-[260px] whitespace-nowrap">
                                <MenuItem
                                    index={0}
                                    icon={FileSearch02}
                                    label={hasPendingRemoval ? "Baja ya solicitada (En revisión)" : "Solicitar baja de laboratorio"}
                                    disabled={hasPendingRemoval}
                                    onSelect={() => {
                                        if (hasPendingRemoval) {
                                            notify.info("Solicitud en revisión", `La baja de ${cleanName} ya fue solicitada y está pendiente de evaluación.`);
                                        } else {
                                            onRequestRemoval(cleanName);
                                        }
                                    }}
                                />
                            </DropdownContent>
                        </DropdownMenu>
                    )}
                </div>
            </div>

            {/* Recuadro interno inferior más claro (Estilo Fluid / Invertido de Inventario Nocturno) */}
            <div className="bg-white dark:bg-surface-3 border border-border/40 rounded-[14px] px-4 py-3.5 shadow-xs flex flex-col gap-3.5 flex-1 justify-between">
                {/* Diferencia neta con cifras tabulares y ajuste óptico de Inter */}
                <CounterAnimation 
                    value={Math.abs(differenceValue)} 
                    decimals={0} 
                    prefix={differenceValue < 0 ? "-$" : differenceValue > 0 ? "+$" : "$"}
                    style={{ fontVariationSettings: "'wght' 550, 'opsz' 28" }}
                    className={cn(
                        "text-[26px] leading-[1.15] font-semibold tracking-[0.005em] tabular-nums",
                        differenceValue < 0
                            ? "text-financial-negative"
                            : differenceValue > 0
                            ? "text-financial-positive"
                            : hasActivity
                            ? "text-foreground"
                            : "text-muted-foreground/60"
                    )}
                />

                {/* Columnas sobrante / faltante + barra */}
                <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-4">
                        {/* Sobrante */}
                        <div className={cn(
                            "border-l-2 pl-2.5 flex flex-col gap-1 transition-colors",
                            positiveValue > 0 ? "border-financial-positive" : "border-border/40"
                        )}>
                            <div className="flex flex-col gap-0.5">
                                <span
                                    style={{ fontVariationSettings: "'wght' 500, 'opsz' 16" }}
                                    className={cn(
                                        "text-[15px] leading-[1.2] font-medium tracking-[0.01em] tabular-nums",
                                        positiveValue > 0 ? "text-card-foreground" : "text-muted-foreground/60"
                                    )}
                                >
                                    <CounterAnimation value={positiveValue} prefix="+$" />
                                </span>
                                <span className="text-[11px] leading-[1.2] text-muted-foreground font-normal">sobrante</span>
                            </div>
                            <div className={cn(
                                "text-[11px] leading-[1.3] font-medium flex items-center gap-1 tabular-nums",
                                positiveValue > 0 ? "text-financial-positive" : "text-muted-foreground/50"
                            )}>
                                <span>↑</span>
                                <span>{sobrantePct}%</span>
                                <span className="text-muted-foreground font-normal">del total</span>
                            </div>
                        </div>

                        {/* Faltante */}
                        <div className={cn(
                            "border-l-2 pl-2.5 flex flex-col gap-1 transition-colors",
                            Math.abs(negativeValue) > 0 ? "border-financial-negative" : "border-border/40"
                        )}>
                            <div className="flex flex-col gap-0.5">
                                <span
                                    style={{ fontVariationSettings: "'wght' 500, 'opsz' 16" }}
                                    className={cn(
                                        "text-[15px] leading-[1.2] font-medium tracking-[0.01em] tabular-nums",
                                        Math.abs(negativeValue) > 0 ? "text-card-foreground" : "text-muted-foreground/60"
                                    )}
                                >
                                    <CounterAnimation value={Math.abs(negativeValue)} prefix="-$" />
                                </span>
                                <span className="text-[11px] leading-[1.2] text-muted-foreground font-normal">faltante</span>
                            </div>
                            <div className={cn(
                                "text-[11px] leading-[1.3] font-medium flex items-center gap-1 tabular-nums",
                                Math.abs(negativeValue) > 0 ? "text-financial-negative" : "text-muted-foreground/50"
                            )}>
                                <span>↓</span>
                                <span>{faltantePct}%</span>
                                <span className="text-muted-foreground font-normal">del total</span>
                            </div>
                        </div>
                    </div>

                    {/* Barra de progreso */}
                    <div className="w-full h-2 bg-muted/60 rounded-full overflow-hidden flex">
                        <div
                            className="h-full bg-financial-positive transition-[width] duration-500 ease-out"
                            style={{ width: `${greenBarPct}%`, backgroundColor: 'var(--financial-positive)' }}
                        />
                        <div
                            className="h-full transition-[width] duration-500 ease-out bg-financial-negative-subtle text-financial-negative"
                            style={{
                                width: `${orangeBarPct}%`,
                                backgroundImage:
                                    "repeating-linear-gradient(90deg, currentColor, currentColor 2px, transparent 2px, transparent 6px)",
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
