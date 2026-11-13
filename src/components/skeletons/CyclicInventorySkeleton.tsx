import { Skeleton } from "@/components/ui/skeleton";

export function CyclicInventorySkeleton() {
  return (
    <div className="w-full max-w-none mx-auto pt-3 pb-32 lg:pb-10 px-4 lg:px-6 space-y-4 lg:space-y-6 animate-pulse">
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
              <div key={i} className="flex flex-col gap-2 pt-3 md:pt-0 md:px-4 first:pl-0">
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
        {/* Pestañas de Rubros */}
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
        </div>

        {/* Toolbar derecha */}
        <div className="flex items-center gap-2 justify-end">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-9 w-56 rounded-lg" />
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
      </div>

      {/* Grid de Cards de Laboratorios (hasta 5 columnas adaptativas igual que la vista real) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-[1640px]:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="bg-muted border border-border/40 rounded-2xl p-[2px] flex flex-col justify-between shadow-xs"
          >
            {/* Barra superior de la tarjeta */}
            <div className="px-3 py-2 flex items-center justify-between gap-2 h-10">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Skeleton className="h-7 w-7 rounded-lg shrink-0" />
                <Skeleton className="h-3.5 w-28" />
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Skeleton className="h-3.5 w-9" />
                <Skeleton className="h-6 w-6 rounded-lg" />
              </div>
            </div>

            {/* Recuadro interno inferior */}
            <div className="bg-white dark:bg-surface-3 border border-border/40 rounded-[14px] p-4 flex flex-col gap-3 flex-1 justify-between">
              <Skeleton className="h-7 w-36" />
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="border-l-2 border-border/40 pl-2.5 flex flex-col gap-1.5">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-2.5 w-12" />
                    <Skeleton className="h-2.5 w-16" />
                  </div>
                  <div className="border-l-2 border-border/40 pl-2.5 flex flex-col gap-1.5">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-2.5 w-12" />
                    <Skeleton className="h-2.5 w-16" />
                  </div>
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
