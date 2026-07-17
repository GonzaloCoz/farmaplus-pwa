"use client";

import {
  Bar,
  BarChart,
  Rectangle,
  ReferenceLine,
  Tooltip,
  XAxis,
  type BarShapeProps,
  type CartesianViewBox,
} from "recharts";
import { type ChartConfig, ChartContainer } from "@/components/evilcharts/ui/chart";
import { ChartBackground } from "@/components/evilcharts/ui/background";
import { useMotionValueEvent, useSpring } from "motion/react";
import { CounterAnimation } from "@/components/CounterAnimation";
import * as React from "react";
import { RefreshCw01 as Loader2 } from '@untitledui/icons';
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/contexts/UserContext";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "@/hooks/useTheme";
import { Tooltip as BaseTooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { normalizeString } from "@/lib/utils";

// Extra top margin so the units badge is never clipped at the top of the chart
const CHART_TOP_MARGIN = 28;

interface TrendsChartWidgetProps {
  type?: "positive" | "negative";
}

export function TrendsChartWidget({ type = "positive" }: TrendsChartWidgetProps) {
  const { user } = useUser();
  const { theme } = useTheme();
  
  // activeIndex holds the hovered index (for bar highlight)
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
  // clickedIndex holds the pinned/selected index
  const [clickedIndex, setClickedIndex] = React.useState<number | null>(null);
  // ref to always have the last hovered index available synchronously on click
  const lastHoveredRef = React.useRef<number | null>(null);
  
  const [isDark, setIsDark] = React.useState(false);

  // ── Sync with document dark class dynamically using MutationObserver ──
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Initial check
    setIsDark(document.documentElement.classList.contains("dark"));

    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  // ── Determine badge colors based on theme and metric type ──
  const getBadgeColors = React.useCallback((metricType: "positive" | "negative") => {
    if (isDark) {
      return metricType === "positive"
        ? { text: "#32c791", bg: "#1d2d27" }
        : { text: "#f77171", bg: "#312323" };
    } else {
      return metricType === "positive"
        ? { text: "#10b981", bg: "#e7f8f2" }
        : { text: "#ef4848", bg: "#fdecec" };
    }
  }, [isDark]);

  const queryClient = useQueryClient();

  // ── Fetch adjustments data from database ──
  const { data: dbData, isLoading } = useQuery({
    queryKey: ["historical-adjustments", user?.branchName],
    queryFn: async () => {
      if (!user?.branchName) return [];
      const cleanBranch = normalizeString(user.branchName);
      const { data, error } = await supabase
        .from("inventory_adjustments")
        .select("created_at, shortage_value, surplus_value, total_units_adjusted")
        .eq("branch_name", cleanBranch)
        .order("created_at", { ascending: true });
      if (error) {
        console.error("Error loading historical adjustments:", error);
        throw error;
      }
      return data || [];
    },
    enabled: !!user?.branchName,
    staleTime: 1000 * 60 * 5,
  });

  // ── Fetch live current-month metrics directly from inventories (via RPC) ──
  // ponytail: avoids frozen branch_laboratories values from previous cycles
  const { data: liveLabs, isLoading: isLiveLoading } = useQuery({
    queryKey: ["live-current-month-metrics", user?.branchName],
    queryFn: async () => {
      if (!user?.branchName) return null;
      const cleanBranch = normalizeString(user.branchName);
      const { data, error } = await (supabase as any).rpc(
        "get_branch_current_month_metrics",
        { p_branch_name: cleanBranch }
      );
      if (error) {
        console.error("Error loading current-month metrics:", error);
        throw error;
      }
      // RPC returns an array with one row
      return (data && data.length > 0) ? data[0] : null;
    },
    enabled: !!user?.branchName,
    staleTime: 1000 * 60 * 2,
  });

  // ── Set up realtime subscription to adjustments and labs ──
  React.useEffect(() => {
    if (!user?.branchName) return;
    
    const cleanBranch = normalizeString(user.branchName);
    
    const channel = supabase
      .channel(`dashboard-realtime-${cleanBranch}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inventories",
          filter: `branch_name=eq.${cleanBranch}`
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["live-current-month-metrics", user.branchName]
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inventory_adjustments",
          filter: `branch_name=eq.${cleanBranch}`
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["historical-adjustments", user.branchName]
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.branchName, queryClient]);

  // ── Process data month-by-month ──
  const chartData = React.useMemo(() => {
    if (!user?.branchName) return [];

    const MONTH_NAMES = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIdx = now.getMonth();
    const currentYearMonth = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, "0")}`;

    const grouped: Record<string, any> = {};

    // 1. Process historical data (excluding current month to avoid double-counting)
    if (dbData && dbData.length > 0) {
      dbData.forEach((row: any) => {
        const date = new Date(row.created_at);
        const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        
        if (yearMonth === currentYearMonth) return;

        if (!grouped[yearMonth]) {
          grouped[yearMonth] = {
            yearMonth,
            month: MONTH_NAMES[date.getMonth()],
            shortage: 0,
            surplus: 0,
            shortage_units: 0,
            surplus_units: 0,
            dateObj: date,
          };
        }
        grouped[yearMonth].shortage += Number(row.shortage_value || 0);
        grouped[yearMonth].surplus += Number(row.surplus_value || 0);
        const total = Number(row.shortage_value || 0) + Number(row.surplus_value || 0);
        const totalUnits = Number(row.total_units_adjusted || 0);
        if (total > 0) {
          grouped[yearMonth].shortage_units += Math.round(totalUnits * (Number(row.shortage_value || 0) / total));
          grouped[yearMonth].surplus_units += Math.round(totalUnits * (Number(row.surplus_value || 0) / total));
        } else {
          grouped[yearMonth].shortage_units += Math.round(totalUnits / 2);
          grouped[yearMonth].surplus_units += Math.round(totalUnits / 2);
        }
      });
    }

    // 2. Datos del mes actual: directamente desde inventories (via RPC) — sin valores congelados
    const liveSurplusValue  = Number(liveLabs?.surplus_value  ?? 0);
    const liveShortageValue = Number(liveLabs?.shortage_value ?? 0);
    const liveSurplusUnits  = Number(liveLabs?.surplus_units  ?? 0);
    const liveShortageUnits = Number(liveLabs?.shortage_units ?? 0);

    // Solo agrega el mes actual si hay datos reales
    if (liveSurplusValue > 0 || liveShortageValue > 0 || liveSurplusUnits > 0 || liveShortageUnits > 0) {
      grouped[currentYearMonth] = {
        yearMonth: currentYearMonth,
        month: MONTH_NAMES[currentMonthIdx],
        shortage: liveShortageValue,
        surplus: liveSurplusValue,
        shortage_units: liveShortageUnits,
        surplus_units: liveSurplusUnits,
        dateObj: now,
      };
    }

    const sortedList = Object.values(grouped)
      .sort((a: any, b: any) => a.dateObj.getTime() - b.dateObj.getTime())
      .map((item: any) => ({
        month: item.month,
        value: type === "positive" ? Math.round(item.surplus) : Math.round(item.shortage),
        units: type === "positive" ? item.surplus_units : item.shortage_units,
      }));

    // Calculate month-over-month change percentage
    return sortedList.map((item: any, idx: number) => {
      let changePercentage: number | null = null;
      if (idx > 0) {
        const prevValue = sortedList[idx - 1].value;
        if (prevValue > 0) {
          changePercentage = ((item.value - prevValue) / prevValue) * 100;
        } else if (item.value > 0) {
          changePercentage = 100;
        } else {
          changePercentage = 0;
        }
      }
      return {
        ...item,
        changePercentage,
      };
    });
  }, [dbData, liveLabs, user?.branchName, type]);

  // ── Default to last month ──
  const defaultData = React.useMemo(() => {
    if (chartData.length === 0) return { index: 0, month: "Sin datos", value: 0, units: 0, changePercentage: null };
    const idx = chartData.length - 1;
    return {
      index: idx,
      month: chartData[idx].month,
      value: chartData[idx].value,
      units: chartData[idx].units,
      changePercentage: chartData[idx].changePercentage,
    };
  }, [chartData]);

  // Priority: pinned (clickedIndex) > hover (activeIndex) > last month (defaultData)
  // Pinned takes full priority so the header stays fixed while hovering
  const selectedData = React.useMemo(() => {
    if (clickedIndex !== null && chartData[clickedIndex]) {
      return {
        index: clickedIndex,
        month: chartData[clickedIndex].month,
        value: chartData[clickedIndex].value,
        units: chartData[clickedIndex].units,
        changePercentage: chartData[clickedIndex].changePercentage,
      };
    }
    if (activeIndex !== null && chartData[activeIndex]) {
      return {
        index: activeIndex,
        month: chartData[activeIndex].month,
        value: chartData[activeIndex].value,
        units: chartData[activeIndex].units,
        changePercentage: chartData[activeIndex].changePercentage,
      };
    }
    return defaultData;
  }, [activeIndex, clickedIndex, chartData, defaultData]);

  // For bar highlight: hover takes visual priority even when pinned
  const highlightedIndex = activeIndex ?? clickedIndex ?? defaultData.index;

  // ── Spring for reference line position ──
  const valueSpring = useSpring(selectedData.value, { stiffness: 110, damping: 20 });
  const [springValue, setSpringValue] = React.useState(selectedData.value);

  React.useEffect(() => {
    valueSpring.set(selectedData.value);
  }, [selectedData.value, valueSpring]);

  const handleBarHover = React.useCallback(
    (index: number) => {
      setActiveIndex(index);
      lastHoveredRef.current = index;
      // Only animate spring to hover value if no pin — pinned header stays fixed
      if (clickedIndex === null) {
        valueSpring.set(chartData[index]?.value ?? defaultData.value);
      }
    },
    [chartData, clickedIndex, defaultData.value, valueSpring],
  );

  // Handle click on chart area using the ref for reliability
  const handleChartClick = React.useCallback(() => {
    const idx = lastHoveredRef.current;
    if (idx === null) return;
    setClickedIndex((prev) => {
      const next = prev === idx ? null : idx;
      // Update spring to pinned value or default
      const targetValue = next !== null && chartData[next]
        ? chartData[next].value
        : defaultData.value;
      valueSpring.set(targetValue);
      return next;
    });
  }, [chartData, defaultData.value, valueSpring]);

  useMotionValueEvent(valueSpring, "change", (latest) => {
    setSpringValue(Math.round(Number(latest)));
  });

  // ── Chart config: neutral bars ──
  const chartConfig = React.useMemo<ChartConfig>(
    () => ({
      value: {
        label: type === "positive" ? "Sobrante" : "Faltante",
        colors: {
          light: ["var(--foreground)"],
          dark: ["var(--foreground)"],
        },
      },
    }),
    [type],
  );

  const labelText = type === "positive" ? "Sobrante" : "Faltante";

  // Determine if percentage change is favorable (success) or unfavorable (destructive)
  const isFavorable = type === "positive"
    ? (selectedData.changePercentage ?? 0) >= 0
    : (selectedData.changePercentage ?? 0) < 0;

  const percentColors = getBadgeColors(isFavorable ? "positive" : "negative");
  const unitsColors = getBadgeColors(type);

  // ── Loading ──
  if (isLoading || isLiveLoading) {
    return (
      <div className="h-full flex items-center justify-center p-6 min-h-[180px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Empty ──
  if (chartData.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 min-h-[180px]">
        <span className="text-sm font-medium text-muted-foreground/80">{labelText} por Mes</span>
        <p className="text-xs text-muted-foreground/60 max-w-[240px]">
          No se registran datos de ajustes finalizados.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {/* ── CSS Override to target all Recharts focused groups and remove focus outlines ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        .recharts-wrapper,
        .recharts-wrapper *,
        .recharts-wrapper *:focus,
        .recharts-wrapper *:focus-visible,
        .recharts-wrapper *:focus-within,
        .recharts-wrapper *:active,
        .recharts-wrapper svg,
        .recharts-wrapper rect,
        .recharts-wrapper path,
        .recharts-wrapper g {
          outline: none !important;
          box-shadow: none !important;
        }
      `}} />

      {/* ── Header – padding y alineación premium ── */}
      <CardHeader className="flex flex-col @sm:flex-row @sm:items-center justify-between space-y-0 px-5 pt-4 pb-0 text-foreground gap-1.5 @sm:gap-2">
        {/* Título con tooltip explicativo */}
        <BaseTooltip>
          <TooltipTrigger render={
            <CardTitle className="text-lg font-medium tracking-tight cursor-help whitespace-nowrap">
              {labelText}
            </CardTitle>
          } />
          <TooltipContent>
            <p className="text-xs max-w-[240px]">
              {type === "positive"
                ? "Valor total de mercadería sobrante detectada en los ajustes de inventario cíclico. Incluye artículos con stock real superior al registrado."
                : "Valor total de mercadería faltante detectada en los ajustes de inventario cíclico. Incluye artículos con stock real inferior al registrado."}
            </p>
          </TooltipContent>
        </BaseTooltip>

        {/* Mes (Completo) + valor + porcentaje en la misma línea (adaptable) */}
        <div className="flex items-center gap-2 @sm:gap-3 flex-wrap justify-start @sm:justify-end">
          <span className="text-xs @sm:text-sm font-medium text-muted-foreground capitalize">
            {selectedData.month}
          </span>
          <div className="flex items-center gap-1.5 @sm:gap-2">
            <CounterAnimation
              value={selectedData.value}
              decimals={0}
              prefix="$"
              className="text-base @sm:text-lg font-medium tracking-tight text-foreground tabular-nums"
            />
            {selectedData.changePercentage !== null && (
              <BaseTooltip>
                <TooltipTrigger render={
                  <span 
                    className="text-[10px] @sm:text-xs font-bold px-1.5 py-0.5 rounded-md tabular-nums transition-colors duration-200 cursor-help"
                    style={{ color: percentColors.text, backgroundColor: percentColors.bg }}
                  >
                    {selectedData.changePercentage >= 0 ? "+" : ""}
                    {selectedData.changePercentage.toFixed(1)}%
                  </span>
                } />
                <TooltipContent>
                  <p className="text-xs max-w-[220px]">
                    {type === "positive"
                      ? "Variación de mercadería sobrante respecto al mes anterior."
                      : "Variación de mercadería faltante respecto al mes anterior."}
                  </p>
                </TooltipContent>
              </BaseTooltip>
            )}
          </div>
        </div>
      </CardHeader>

      {/* ── Bar Chart ── */}
      <div
        className="flex-1 min-h-[100px] w-full pb-2"
        onClick={handleChartClick}
        style={{ cursor: "pointer" }}
      >
        <ChartContainer
          config={chartConfig}
          className="h-full w-full outline-none"
          tabIndex={-1}
          style={{ outline: "none" }}
        >
          <BarChart
            accessibilityLayer={false}
            data={chartData}
            margin={{ top: CHART_TOP_MARGIN, left: 0, right: 8, bottom: 0 }}
            style={{ outline: "none" }}
            onMouseMove={(state) => {
              if (state?.activeTooltipIndex != null) {
                handleBarHover(Number(state.activeTooltipIndex));
              }
            }}
            onMouseLeave={() => {
              setActiveIndex(null);
              lastHoveredRef.current = null;
              // Spring goes to pinned value, or default if nothing pinned
              valueSpring.set(
                clickedIndex !== null && chartData[clickedIndex]
                  ? chartData[clickedIndex].value
                  : defaultData.value
              );
            }}
          >
            {/* Chart dots background */}
            <ChartBackground variant="dots" />

            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value: string) => value.slice(0, 3)}
            />

            <Tooltip cursor={false} content={() => null} />

            <Bar
              dataKey="value"
              fill="var(--foreground)"
              radius={4}
              shape={(props: BarShapeProps) => (
                <HoverTraceBarShape
                  {...props}
                  highlightedIndex={highlightedIndex}
                  isPinned={clickedIndex === (props as any).index}
                />
              )}
            />

            <ReferenceLine
              y={springValue}
              stroke="var(--foreground)"
              strokeDasharray="3 3"
              label={
                <HoverTraceLabel
                  value={selectedData.value}
                  units={selectedData.units}
                  bgFill={unitsColors.bg}
                  textFill={unitsColors.text}
                />
              }
            />
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  );
}

// ── Label on reference line ──
interface HoverTraceLabelProps {
  viewBox?: CartesianViewBox;
  value: number;
  units: number;
  bgFill: string;
  textFill: string;
}

const HoverTraceLabel = ({ viewBox, units, bgFill, textFill }: HoverTraceLabelProps) => {
  const x = viewBox?.x ?? 0;
  const y = viewBox?.y ?? 0;
  const displayText = `${units} Unidades`;
  
  const fontSize = 12;
  const paddingX = 10;
  const badgeHeight = 22; // Spacious height
  
  // Safe estimation for 12px text width
  const textWidth = displayText.length * 7.0;
  const width = textWidth + paddingX * 2;
  
  const badgeY = Math.max(badgeHeight / 2, y);

  return (
    <g style={{ pointerEvents: 'none' }}>
      {/* Badge background pill */}
      <rect 
        x={x} 
        y={badgeY - badgeHeight / 2} 
        width={width} 
        height={badgeHeight} 
        fill={bgFill} 
        rx={6} 
      />
      {/* Centered text both vertically and horizontally */}
      <text
        fontFamily="sans-serif"
        fontSize={fontSize}
        fontWeight={700}
        x={x + width / 2}
        y={badgeY}
        dy="0.35em"
        textAnchor="middle"
        fill={textFill}
      >
        {displayText}
      </text>
      {/* Dot on right edge */}
      <ellipse cx={"99.5%"} cy={y} rx={3} ry={3} fill={textFill} />
    </g>
  );
};

// ── Bar shape: Neutral colors (var(--foreground)) ──
type HoverTraceBarShapeProps = BarShapeProps & {
  highlightedIndex: number;
  isPinned?: boolean;
};

const HoverTraceBarShape = (props: HoverTraceBarShapeProps) => {
  const { x, y, width, height, index, highlightedIndex, isPinned } = props;
  const isHighlighted = index === highlightedIndex;
  const fillOpacity = isHighlighted ? 0.85 : 0.2;

  return (
    <g style={{ outline: "none" }} tabIndex={-1}>
      {/* Solid background mask so chart background dots don't show through */}
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        radius={4}
        fill="var(--card)"
        stroke="none"
      />
      {/* Transparent interactive shape */}
      <Rectangle {...props} fill="transparent" pointerEvents="all" stroke="none" strokeWidth={0} />
      {/* Foreground bar */}
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        radius={4}
        fill="var(--foreground)"
        fillOpacity={fillOpacity}
        stroke="none"
        strokeWidth={0}
        className="transition-all duration-200"
      />
      {/* Pinned indicator: subtle bottom accent line */}
      {isPinned && (
        <rect
          x={x! + 4}
          y={y! + height! - 3}
          width={width! - 8}
          height={3}
          rx={2}
          fill="var(--foreground)"
          fillOpacity={0.9}
        />
      )}
    </g>
  );
};
