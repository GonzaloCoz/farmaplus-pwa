import React from 'react';
import { FunnelChart } from '@/components/charts/funnel-chart';
import { ScrollArea } from '@/components/ui/scroll-area';

export function PreCountSummaryView() {
    return (
        <ScrollArea orientation="vertical" viewportClassName="scroll-fade pr-1 pb-6 [&>div]:!w-full" className="w-full flex-1 min-h-0 h-full">
            {/* Contenedor exterior estilo Fluid: 2px de padding, bordes redondeados y sombra sutil */}
            <div className="w-full bg-surface-2/60 dark:bg-surface-2/40 border border-border/40 rounded-[24px] p-[2px] transition-all duration-200 shadow-xs">
                {/* Recuadro interior blanco/más claro que ocupa todo el ancho */}
                <div className="w-full bg-white dark:bg-surface-3 border border-border/40 rounded-[22px] p-6 sm:p-8 shadow-xs flex flex-col justify-between min-h-[540px]">
                    <div className="flex flex-col gap-6">
                        {/* Cabecera del gráfico */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-5">
                            <div>
                                <h3 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                                    Embudo de Calidad y Cuadre de Inventario
                                </h3>
                                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                                    Distribución y filtrado de productos auditados sobre el catálogo total evaluado
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                                    80.17% Efectividad
                                </span>
                            </div>
                        </div>

                        {/* Gráfico FunnelChart de Bklit */}
                        <div className="w-full max-w-4xl mx-auto py-4">
                            <FunnelChart
                                data={[
                                    { label: "Total EANs Evaluados", value: 4306, color: "var(--chart-1)" },
                                    { label: "Sin Diferencia (Exactos)", value: 3452, color: "var(--chart-2)" },
                                    { label: "Con Diferencias", value: 854, color: "var(--chart-3)" },
                                    { label: "EANs Sobrantes", value: 462, color: "var(--chart-4)" },
                                    { label: "EANs Faltantes", value: 392, color: "var(--chart-5)" },
                                ]}
                                layers={3}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </ScrollArea>
    );
}

