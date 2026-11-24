"use client";

import type {
  SankeyLink as SankeyLinkType,
  SankeyNode as SankeyNodeType,
} from "d3-sankey";
import { motion, useTransform } from "motion/react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMountProgress } from "../use-mount-progress";
import { useTheme } from "@/hooks/useTheme";
import { transitionWithDelay } from "../motion-utils";
import {
  type SankeyLinkDatum,
  type SankeyNodeDatum,
  useSankey,
} from "./sankey-context";

// Helper to get node index from link source/target
type NodeOrIndex = SankeyNodeType<SankeyNodeDatum, SankeyLinkDatum> | number;

function getNodeIndex(nodeOrIndex: NodeOrIndex): number | undefined {
  if (typeof nodeOrIndex === "number") {
    return nodeOrIndex;
  }
  return nodeOrIndex.index;
}

function getNodeObject(
  nodeOrIndex: NodeOrIndex
): SankeyNodeType<SankeyNodeDatum, SankeyLinkDatum> | null {
  if (typeof nodeOrIndex === "number") {
    return null;
  }
  return nodeOrIndex;
}

// Default node color palette using CSS variables
const defaultColors = [
  "var(--chart-1, #10b981)",
  "var(--chart-2, #3b82f6)",
  "var(--chart-3, #f59e0b)",
  "var(--chart-4, #8b5cf6)",
  "var(--chart-5, #06b6d4)",
];

function getDefaultNodeColor(
  node: SankeyNodeType<SankeyNodeDatum, SankeyLinkDatum>
): string {
  if ((node as any).color) {
    return (node as any).color as string;
  }
  const index = node.index ?? 0;
  return defaultColors[index % defaultColors.length] ?? "var(--chart-1, #10b981)";
}

export interface SankeyLinkProps {
  /** Stroke color for links (overrides gradient). Default: uses gradient */
  stroke?: string;
  /** Stroke opacity. Default: 0.5 */
  strokeOpacity?: number;
  /** Opacity when another link/node is hovered. Default: 0.1 */
  fadedOpacity?: number;
  /** Use gradient from source to target color. Default: true */
  useGradient?: boolean;
  /** Custom function to get node color (for gradient) */
  getNodeColor?: (
    node: SankeyNodeType<SankeyNodeDatum, SankeyLinkDatum>,
    index: number
  ) => string;
  /** Custom link color function (overrides gradient) */
  getLinkColor?: (
    link: SankeyLinkType<SankeyNodeDatum, SankeyLinkDatum>,
    index: number
  ) => string;
  /** Pattern definitions to render in defs. Use @visx/pattern components (PatternLines, PatternCircles, etc.) */
  patterns?: React.ReactNode;
  /** Return pattern ID for a link, or null/undefined to use gradient/solid color */
  getLinkPattern?: (
    link: SankeyLinkType<SankeyNodeDatum, SankeyLinkDatum>,
    index: number
  ) => string | null | undefined;
  /** Show flow amount and percentage labels on the links. Default: true */
  showLabels?: boolean;
  /** Fade the beginning and ending of ribbons into the nodes. Default: true */
  fadeEdges?: boolean;
  /** Opacity at the very edge (0% and 100%) when fadeEdges is true. Default: 0.08 */
  fadeEdgeOpacity?: number;
  /** Minimum ribbon thickness/height in pixels to show labels (default: 8) */
  minHeightForLabels?: number;
  /** Custom formatter for left label (usually monetary amount) */
  formatLeftLabel?: (
    link: SankeyLinkType<SankeyNodeDatum, SankeyLinkDatum>
  ) => string | null | undefined;
  /** Custom formatter for right label (usually percentage) */
  formatRightLabel?: (
    link: SankeyLinkType<SankeyNodeDatum, SankeyLinkDatum>
  ) => string | null | undefined;
}

function formatLinkAmount(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    const val = (abs / 1_000_000).toLocaleString("es-AR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return `${sign}$${val}M`;
  }
  if (abs >= 1_000) {
    const val = (abs / 1_000).toLocaleString("es-AR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return `${sign}$${val}K`;
  }
  return `${sign}$${abs.toLocaleString("es-AR")}`;
}

function calculateTargetPercent(link: any, targetNode: any): string | null {
  if (!targetNode) return null;
  const targetTotal =
    targetNode.targetLinks && targetNode.targetLinks.length > 0
      ? targetNode.targetLinks.reduce(
          (acc: number, l: any) => acc + (l.value ?? 0),
          0
        )
      : (targetNode.value ?? 0);
  if (targetTotal <= 0) return null;
  return `${Math.round(((link.value ?? 0) / targetTotal) * 100)}%`;
}

interface AnimatedLinkProps {
  path: string;
  width: number;
  stroke: string;
  strokeOpacity: number;
  index: number;
  totalLinks: number;
  isFaded: boolean;
  isHighlighted: boolean;
  fadedOpacity: number;
  animationDuration: number;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function AnimatedLink({
  path,
  width,
  stroke,
  strokeOpacity,
  index,
  totalLinks,
  isFaded,
  isHighlighted,
  fadedOpacity,
  animationDuration,
  onMouseEnter,
  onMouseLeave,
}: AnimatedLinkProps) {
  const { enterTransition, revealEpoch } = useSankey();
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState(0);

  // Animación sincronizada con los recuadros verticales (scaleY: 0 -> 1 con stagger)
  const linkAnimDuration = animationDuration * 0.6;
  const staggerDelaySec =
    ((index / totalLinks) * linkAnimDuration * 0.4) / 1000;
  const linkEnter = transitionWithDelay(enterTransition, staggerDelaySec);

  useLayoutEffect(() => {
    if (pathRef.current) {
      const length = pathRef.current.getTotalLength();
      setPathLength(length);
    }
  });

  const progress = useMountProgress(
    enterTransition,
    staggerDelaySec,
    `${revealEpoch}-${index}`
  );
  const strokeDashoffset = useTransform(progress, [0, 1], [pathLength, 0]);

  // Calculate target opacity
  const getTargetOpacity = () => {
    if (isFaded) {
      return fadedOpacity;
    }
    if (isHighlighted) {
      return 0.95;
    }
    return strokeOpacity;
  };
  const targetOpacity = getTargetOpacity();

  // Dasharray for path reveal
  const dashArray = pathLength > 0 ? `${pathLength} ${pathLength}` : "none";

  const isRibbon = path.includes("Z") || path.includes("z");

  return (
    <motion.path
      animate={{ opacity: targetOpacity, scaleY: 1 }}
      d={path}
      fill={isRibbon ? stroke : "none"}
      initial={{ opacity: 0, scaleY: 0 }}
      key={`link-${index}-${revealEpoch}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      ref={pathRef}
      stroke={isRibbon ? "none" : stroke}
      strokeDasharray={isRibbon ? "none" : dashArray}
      strokeWidth={isRibbon ? 0 : Math.max(1, width)}
      style={{
        cursor: "pointer",
        originY: 0.5,
        strokeDashoffset: isRibbon ? undefined : strokeDashoffset,
      }}
      transition={isFaded || isHighlighted ? { duration: 0.18, ease: "easeOut" } : linkEnter}
    />
  );
}

export function SankeyLink({
  stroke,
  strokeOpacity = 0.75,
  fadedOpacity = 0.1,
  useGradient = true,
  getNodeColor,
  getLinkColor,
  patterns,
  getLinkPattern,
  showLabels = true,
  fadeEdges = true,
  fadeEdgeOpacity = 0.08,
  minHeightForLabels = 13,
  formatLeftLabel,
  formatRightLabel,
}: SankeyLinkProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const {
    links,
    hoveredNodeIndex,
    hoveredLinkIndex,
    setHoveredLinkIndex,
    setTooltipData,
    animationDuration,
    createPath,
    enterTransition,
    revealEpoch,
  } = useSankey();

  // Get color for a node (for gradients)
  const getNodeColorFn = useCallback(
    (node: SankeyNodeType<SankeyNodeDatum, SankeyLinkDatum>): string => {
      if (getNodeColor) {
        return getNodeColor(node, node.index ?? 0);
      }
      return getDefaultNodeColor(node);
    },
    [getNodeColor]
  );

  // Get color for a link (solid color, when not using gradient)
  const getLinkColorFn = useCallback(
    (link: SankeyLinkType<SankeyNodeDatum, SankeyLinkDatum>, index: number) => {
      if (getLinkColor) {
        return getLinkColor(link, index);
      }
      return stroke || "var(--chart-line-primary, #3b82f6)";
    },
    [getLinkColor, stroke]
  );

  // Check if any element is hovered
  const isAnyHovered = hoveredNodeIndex !== null || hoveredLinkIndex !== null;

  // Build gradient definitions for all links
  const gradientDefs = useMemo(() => {
    if (!useGradient || stroke || getLinkColor) {
      return null;
    }

    return links.map((link, index) => {
      const sourceNode = getNodeObject(link.source as NodeOrIndex);
      const targetNode = getNodeObject(link.target as NodeOrIndex);

      const sourceColor = sourceNode
        ? getNodeColorFn(sourceNode)
        : "var(--chart-1, #10b981)";
      const targetColor = targetNode
        ? getNodeColorFn(targetNode)
        : "var(--chart-2, #3b82f6)";
      const gradientId = `link-gradient-${index}`;

      const x1 = sourceNode?.x1 ?? 0;
      const x2 = targetNode?.x0 ?? 100;

      return (
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id={gradientId}
          key={gradientId}
          x1={x1}
          x2={x2}
          y1="0"
          y2="0"
        >
          {fadeEdges && isDark ? (
            // Modo Oscuro: estructura anterior restaurada con principio y fin más oscurecidos
            <>
              <stop offset="0%" stopColor={sourceColor} stopOpacity={0.02} />
              <stop offset="6%" stopColor={sourceColor} stopOpacity={0.28} />
              <stop offset="18%" stopColor={sourceColor} stopOpacity={0.92} />
              <stop offset="50%" stopColor={targetColor} stopOpacity={0.96} />
              <stop offset="82%" stopColor={targetColor} stopOpacity={0.92} />
              <stop offset="94%" stopColor={targetColor} stopOpacity={0.28} />
              <stop offset="100%" stopColor={targetColor} stopOpacity={0.02} />
            </>
          ) : (
            // Modo Claro: gradiente puro y luminoso entre origen y destino
            <>
              <stop offset="0%" stopColor={sourceColor} stopOpacity={0.82} />
              <stop offset="100%" stopColor={targetColor} stopOpacity={0.82} />
            </>
          )}
        </linearGradient>
      );
    });
  }, [links, useGradient, stroke, getLinkColor, getNodeColorFn, fadeEdges, fadeEdgeOpacity, isDark]);

  // Opacity adaptativa para que en tema claro los elementos no desaparezcan en blanco puro
  const effectiveRibbonFadedOpacity = isDark ? 0.15 : 0.38;
  const effectiveTextFadedOpacity = isDark ? 0.45 : 0.72;

  // Precomputar posiciones de etiquetas con prevención de colisiones verticales
  const positionedLabels = useMemo(() => {
    if (!showLabels) return [];

    const lastSourceY = new Map<number, number>();
    const lastTargetY = new Map<number, number>();

    return links.map((link, index) => {
      const sIdx = getNodeIndex(link.source as NodeOrIndex) ?? -1;
      const tIdx = getNodeIndex(link.target as NodeOrIndex) ?? -1;
      const sourceNode = getNodeObject(link.source as NodeOrIndex);
      const targetNode = getNodeObject(link.target as NodeOrIndex);

      const x0 =
        sourceNode?.x1 ??
        (typeof (link as any).source === "object"
          ? (link as any).source.x1 ?? 0
          : 0);
      const x1 =
        targetNode?.x0 ??
        (typeof (link as any).target === "object"
          ? (link as any).target.x0 ?? 0
          : 0);

      const hasJustifiedY =
        (link as any).sy0 !== undefined && (link as any).sy1 !== undefined;
      const sourceH = hasJustifiedY
        ? Math.abs((link as any).sy1 - (link as any).sy0)
        : (link.width ?? 1);
      let y0 = hasJustifiedY
        ? sourceH > 28
          ? (link as any).sy0 + 16
          : ((link as any).sy0 + (link as any).sy1) / 2
        : ((link as any).y0 ?? 0);

      // Separación vertical mínima de 20px en origen para evitar que los números se tapen
      const prevSourceY = lastSourceY.get(sIdx);
      if (prevSourceY !== undefined && y0 < prevSourceY + 20) {
        y0 = prevSourceY + 20;
      }
      lastSourceY.set(sIdx, y0);

      const hasTargetJustifiedY =
        (link as any).ty0 !== undefined && (link as any).ty1 !== undefined;
      const targetH = hasTargetJustifiedY
        ? Math.abs((link as any).ty1 - (link as any).ty0)
        : (link.width ?? 1);
      let y1 = hasTargetJustifiedY
        ? targetH > 28
          ? (link as any).ty0 + 16
          : ((link as any).ty0 + (link as any).ty1) / 2
        : ((link as any).y1 ?? 0);

      // Separación vertical mínima de 20px en destino
      const prevTargetY = lastTargetY.get(tIdx);
      if (prevTargetY !== undefined && y1 < prevTargetY + 20) {
        y1 = prevTargetY + 20;
      }
      lastTargetY.set(tIdx, y1);

      const leftText = formatLeftLabel
        ? formatLeftLabel(link)
        : (link as any).formattedAmount ||
          ((link as any).amount !== undefined
            ? formatLinkAmount((link as any).amount)
            : (link as any).leftLabel);

      const rightText = formatRightLabel
        ? formatRightLabel(link)
        : (link as any).rightLabel ||
          (link as any).targetPercent ||
          calculateTargetPercent(link, targetNode);

      return {
        link,
        index,
        sourceIdx: sIdx,
        targetIdx: tIdx,
        x0,
        x1,
        y0,
        y1,
        leftText,
        rightText,
      };
    });
  }, [links, showLabels, formatLeftLabel, formatRightLabel]);

  return (
    <g className="sankey-links">
      <defs>
        {patterns}
        {gradientDefs}
      </defs>

      {links.map((link, index) => {
        const path = createPath(link);
        const linkWidth = link.width ?? 1;

        if (!path || path.trim() === "") {
          return null;
        }

        const sIdx = getNodeIndex(link.source as NodeOrIndex);
        const tIdx = getNodeIndex(link.target as NodeOrIndex);

        const sourceIdx =
          sIdx ?? (typeof link.source === "number" ? link.source : -1);
        const targetIdx =
          tIdx ?? (typeof link.target === "number" ? link.target : -1);

        const isHighlighted =
          hoveredLinkIndex === index ||
          hoveredNodeIndex === sourceIdx ||
          hoveredNodeIndex === targetIdx;
        const isFaded = isAnyHovered && !isHighlighted;

        const handleMouseEnter = () => {
          setHoveredLinkIndex(index);
          setTooltipData({
            type: "link",
            linkIndex: index,
            x: 0,
            y: 0,
            data: link,
          });
        };

        const handleMouseLeave = () => {
          setHoveredLinkIndex(null);
          setTooltipData(null);
        };

        let linkStroke: string;
        const patternId = getLinkPattern?.(link, index);
        if (patternId) {
          linkStroke = `url(#${patternId})`;
        } else if (useGradient && !stroke && !getLinkColor) {
          linkStroke = `url(#link-gradient-${index})`;
        } else {
          linkStroke = getLinkColorFn(link, index);
        }

        return (
          <AnimatedLink
            animationDuration={animationDuration}
            fadedOpacity={effectiveRibbonFadedOpacity}
            index={index}
            isFaded={isFaded}
            isHighlighted={isHighlighted}
            key={`link-${sourceIdx}-${targetIdx}-${link.width ?? link.value ?? index}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            path={path}
            stroke={linkStroke}
            strokeOpacity={strokeOpacity}
            totalLinks={links.length}
            width={linkWidth}
          />
        );
      })}

      {showLabels && (
        <g className="sankey-link-labels" pointerEvents="none">
          {positionedLabels.map((item) => {
            const isHighlighted =
              hoveredLinkIndex === item.index ||
              hoveredNodeIndex === item.sourceIdx ||
              hoveredNodeIndex === item.targetIdx;
            const isFaded = isAnyHovered && !isHighlighted;

            const showLeft = Boolean(item.leftText);
            const showRight = Boolean(item.rightText);

            const textOpacity = isHighlighted
              ? 1
              : isFaded
              ? effectiveTextFadedOpacity
              : isDark
              ? 0.95
              : 0.92;

            // En tema claro usamos pizarra profundo de alto contraste; en tema oscuro blanco
            const textColor = isDark
              ? "#ffffff"
              : isHighlighted
              ? "#09090b"
              : isFaded
              ? "#334155"
              : "#1e293b";

            // Sincronizar aparición suave de textos con las franjas
            const labelDelay =
              ((item.index / Math.max(1, links.length)) *
                (animationDuration * 0.6) *
                0.4 +
                animationDuration * 0.6 * 0.3) /
              1000;
            const labelEnter = transitionWithDelay(enterTransition, labelDelay);
            const labelTransition =
              isFaded || isHighlighted ? { duration: 0.15 } : labelEnter;

            return (
              <g key={`link-label-${item.sourceIdx}-${item.targetIdx}-${item.index}`}>
                {showLeft && (
                  <motion.text
                    animate={{ opacity: textOpacity }}
                    className={`font-sans text-[13px] tracking-[-0.015em] select-none pointer-events-none transition-all duration-150 ${
                      isHighlighted ? "font-medium" : "font-normal"
                    }`}
                    dominantBaseline="central"
                    fill={textColor}
                    initial={{ opacity: 0 }}
                    key={`link-label-left-${item.index}-${revealEpoch}`}
                    textAnchor="start"
                    transition={labelTransition}
                    x={item.x0 + 14}
                    y={item.y0}
                  >
                    {item.leftText}
                  </motion.text>
                )}
                {showRight && (
                  <motion.text
                    animate={{ opacity: textOpacity }}
                    className={`font-sans text-[13px] tracking-[-0.015em] select-none pointer-events-none transition-all duration-150 ${
                      isHighlighted ? "font-medium" : "font-normal"
                    }`}
                    dominantBaseline="central"
                    fill={textColor}
                    initial={{ opacity: 0 }}
                    key={`link-label-right-${item.index}-${revealEpoch}`}
                    textAnchor="end"
                    transition={labelTransition}
                    x={item.x1 - 14}
                    y={item.y1}
                  >
                    {item.rightText}
                  </motion.text>
                )}
              </g>
            );
          })}
        </g>
      )}
    </g>
  );
}

SankeyLink.displayName = "SankeyLink";

export default SankeyLink;
