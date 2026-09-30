import { Skeleton } from "@/components/ui/skeleton";

export function CyclicInventorySkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto animate-pulse">
      {/* Resumen del Panel con doble recuadro concéntrico */}
      <div className="w-full bg-surface-2/60 dark:bg-surface-2/40 border border-border/40 rounded-[24px] p-[2px]">
        <div className="w-full bg-white dark:bg-surface-3 border border-border/40 rounded-[22px] px-5 sm:px-6 pt-3.5 pb-4 sm:pt-4 sm:pb-5 flex flex-col gap-4 sm:gap-5">
          {/* Top: Header / Rubro Title & Badges */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-28" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-36" />
                <span className="text-muted-foreground/30">›</span>
                <Skeleton className="h-5 w-24" />
              </div>
            </div>

            {/* Badges y Selector de modo */}
            <div className="flex flex-wrap items-center gap-2.5">
              <Skeleton className="h-7 w-28 rounded-lg" />
              <Skeleton className="h-7 w-24 rounded-lg" />
              <Skeleton className="h-7 w-24 rounded-lg" />
              <Skeleton className="h-8 w-32 rounded-lg" />
            </div>
          </div>

          {/* Bottom: Financial/Unit Values en 4 columnas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 divide-y md:divide-y-0 md:divide-x divide-border/40 w-full pt-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2 pt-3 md:pt-0 md:px-3 first:pl-0">
                <Skeleton className="h-3 w-24" />
                <div className="flex items-baseline gap-2">
                  <Skeleton className="h-7 w-28" />
                  <Skeleton className="h-4 w-10" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Toolbar / Filtros y Búsqueda */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        {/* Pestañas de Rubros */}
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
        </div>

        {/* Toolbar derecha */}
        <div className="flex items-center gap-2.5 justify-end">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-9 w-56 rounded-lg" />
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-9 w-18 rounded-lg" />
        </div>
      </div>

      {/* Grid de Cards de Laboratorios */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-4 shadow-xs"
          >
            {/* Header del card: Nombre y Estado */}
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3.5 w-24" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>

            {/* Barra de progreso */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-10" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>

            {/* Fila de métricas */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/30">
              <div className="space-y-1">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
