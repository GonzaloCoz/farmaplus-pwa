"use client";

import { localPoint } from "@visx/event";
import { ParentSize } from "@visx/responsive";
import { sankey, sankeyCenter, sankeyLinkHorizontal } from "@visx/sankey";
import type { Transition } from "motion/react";
import {
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import {
  type Margin,
  type SankeyLinkDatum,
  type SankeyNodeDatum,
  SankeyProvider,
  type SankeyTooltipData,
} from "./sankey-context";

export interface SankeyData {
  nodes: SankeyNodeDatum[];
  links: SankeyLinkDatum[];
}

export interface SankeyChartProps {
  /** Sankey data with nodes and links */
  data: SankeyData;
  /** Chart margins */
  margin?: Partial<Margin>;
  /** Animation duration in milliseconds. Default: 1100 */
  animationDuration?: number;
  /** Motion enter transition (spring or cubic-bezier tween). */
  enterTransition?: Transition;
  /** Signature of motion URL state — triggers enter replay when it changes. */
  revealSignature?: string;
  /** Aspect ratio as "width / height". Default: "2 / 1" */
  aspectRatio?: string;
  /** Node width in pixels. Default: 16 */
  nodeWidth?: number;
  /** Node padding in pixels. Default: 24 */
  nodePadding?: number;
  /** Additional class name for the container */
  className?: string;
  /** Align node columns to span from 0 to innerHeight, creating a square bounding box. Default: true */
  justifyBounds?: boolean;
  /** Child components (SankeyNode, SankeyLink, SankeyTooltip) */
  children: ReactNode;
  /** Controlled hovered node index (e.g. from ChartLegend). */
  hoveredNodeIndex?: number | null;
  /** Called when node hover changes from the chart surface. */
  onNodeHoverChange?: (index: number | null) => void;
}

const DEFAULT_MARGIN: Margin = { top: 40, right: 180, bottom: 40, left: 180 };

interface SankeyChartInnerProps {
  data: SankeyData;
  width: number;
  height: number;
  margin: Margin;
  animationDuration: number;
  enterTransition?: Transition;
  revealSignature?: string;
  nodeWidth: number;
  nodePadding: number;
  justifyBounds?: boolean;
  children: ReactNode;
  hoveredNodeIndexProp?: number | null;
  onNodeHoverChange?: (index: number | null) => void;
}

function SankeyChartInner(props: SankeyChartInnerProps) {
  const { width, height } = props;

  if (width < 10 || height < 10) {
    return null;
  }

  return <SankeyChartCore {...props} />;
}

function justifySankeyLayout(
  graph: any,
  innerHeight: number,
  nodePadding: number
) {
  if (!graph.nodes || graph.nodes.length === 0) return;

  // Group nodes by depth
  const columns = new Map<number, any[]>();
  for (const node of graph.nodes) {
    const depth = node.depth ?? 0;
    if (!columns.has(depth)) {
      columns.set(depth, []);
    }
    columns.get(depth)!.push(node);
  }

  // Adjust each column to span exactly [0, innerHeight]
  for (const [, colNodes] of columns) {
    colNodes.sort((a, b) => (a.y0 ?? 0) - (b.y0 ?? 0));
    const k = colNodes.length;
    const totalVal = colNodes.reduce((sum: number, n: any) => sum + (n.value ?? 0), 0) || 1;
    const totalPadding = (k - 1) * nodePadding;
    const availHeight = Math.max(k * 10, innerHeight - totalPadding);

    let curY = 0;
    for (const node of colNodes) {
      const h = Math.max(10, (availHeight * (node.value ?? 0)) / totalVal);
      node.y0 = curY;
      node.y1 = curY + h;
      curY += h + nodePadding;
    }
  }

  // Adjust link positions so they seamlessly connect the updated node bounds
  for (const node of graph.nodes) {
    // Outgoing links
    if (node.sourceLinks && node.sourceLinks.length > 0) {
      node.sourceLinks.sort((a: any, b: any) => {
        const targetA = typeof a.target === "object" ? a.target.y0 ?? 0 : 0;
        const targetB = typeof b.target === "object" ? b.target.y0 ?? 0 : 0;
        return targetA - targetB;
      });
      const nodeH = (node.y1 ?? 0) - (node.y0 ?? 0);
      const totalOutVal = node.sourceLinks.reduce((sum: number, l: any) => sum + l.value, 0) || (node.value ?? 1);
      let sy = node.y0 ?? 0;
      for (const l of node.sourceLinks) {
        const linkW = (nodeH * l.value) / totalOutVal;
        l.sy0 = sy;
        l.sy1 = sy + linkW;
        l.width = linkW;
        l.y0 = sy + linkW / 2;
        sy += linkW;
      }
    }

    // Incoming links
    if (node.targetLinks && node.targetLinks.length > 0) {
      node.targetLinks.sort((a: any, b: any) => {
        const sourceA = typeof a.source === "object" ? a.source.y0 ?? 0 : 0;
        const sourceB = typeof b.source === "object" ? b.source.y0 ?? 0 : 0;
        return sourceA - sourceB;
      });
      const nodeH = (node.y1 ?? 0) - (node.y0 ?? 0);
      const totalInVal = node.targetLinks.reduce((sum: number, l: any) => sum + l.value, 0) || (node.value ?? 1);
      let ty = node.y0 ?? 0;
      for (const l of node.targetLinks) {
        const linkW = (nodeH * l.value) / totalInVal;
        l.ty0 = ty;
        l.ty1 = ty + linkW;
        l.y1 = ty + linkW / 2;
        ty += linkW;
      }
    }
  }
}

const SankeyChartCore = memo(function SankeyChartCore({
  data,
  width,
  height,
  margin,
  animationDuration,
  enterTransition,
  revealSignature = "",
  nodeWidth,
  nodePadding,
  justifyBounds = true,
  children,
  hoveredNodeIndexProp,
  onNodeHoverChange,
}: SankeyChartInnerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [revealEpoch, setRevealEpoch] = useState(0);
  const [internalHoveredNodeIndex, setInternalHoveredNodeIndex] = useState<
    number | null
  >(null);
  const isNodeHoverControlled = hoveredNodeIndexProp !== undefined;
  const hoveredNodeIndex = isNodeHoverControlled
    ? hoveredNodeIndexProp
    : internalHoveredNodeIndex;
  const setHoveredNodeIndex = useCallback(
    (index: number | null) => {
      if (isNodeHoverControlled) {
        onNodeHoverChange?.(index);
      } else {
        setInternalHoveredNodeIndex(index);
      }
    },
    [isNodeHoverControlled, onNodeHoverChange]
  );
  const [hoveredLinkIndex, setHoveredLinkIndex] = useState<number | null>(null);
  const [tooltipData, setTooltipData] = useState<SankeyTooltipData | null>(
    null
  );
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
    null
  );

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // biome-ignore lint/correctness/useExhaustiveDependencies: revealSignature
  useEffect(() => {
    setRevealEpoch((n) => n + 1);
    setIsLoaded(false);
    const timeout = setTimeout(() => {
      setIsLoaded(true);
    }, animationDuration);
    return () => clearTimeout(timeout);
  }, [animationDuration, revealSignature]);

  const sankeyGenerator = useMemo(() => {
    return sankey<SankeyNodeDatum, SankeyLinkDatum>()
      .nodeWidth(nodeWidth)
      .nodePadding(nodePadding)
      .nodeAlign(sankeyCenter)
      .extent([
        [0, 0],
        [Math.max(10, innerWidth), Math.max(10, innerHeight)],
      ]);
  }, [innerWidth, innerHeight, nodeWidth, nodePadding]);

  const graph = useMemo(() => {
    const clonedData = {
      nodes: data.nodes.map((node) => ({ ...node })),
      links: data.links.map((link) => ({ ...link })),
    };
    try {
      const g = sankeyGenerator(clonedData);
      if (justifyBounds) {
        justifySankeyLayout(g, innerHeight, nodePadding);
      }
      return g;
    } catch {
      return { nodes: [], links: [] };
    }
  }, [data, sankeyGenerator, justifyBounds, innerHeight, nodePadding]);

  const createPath = useCallback(
    // biome-ignore lint/suspicious/noExplicitAny: d3-sankey types are complex
    (link: any) => {
      try {
        const x0 = typeof link.source === "object" ? link.source.x1 ?? 0 : 0;
        const x1 = typeof link.target === "object" ? link.target.x0 ?? 0 : 0;

        if (
          link.sy0 !== undefined &&
          link.sy1 !== undefined &&
          link.ty0 !== undefined &&
          link.ty1 !== undefined
        ) {
          const dx = (x1 - x0) * 0.5;
          const y0Top = link.sy0;
          const y0Bottom = link.sy1;
          const y1Top = link.ty0;
          const y1Bottom = link.ty1;
          return `M ${x0},${y0Top} C ${x0 + dx},${y0Top} ${x1 - dx},${y1Top} ${x1},${y1Top} L ${x1},${y1Bottom} C ${x1 - dx},${y1Bottom} ${x0 + dx},${y0Bottom} ${x0},${y0Bottom} Z`;
        }

        const pathGenerator = sankeyLinkHorizontal();
        return pathGenerator(link) || "";
      } catch {
        return "";
      }
    },
    []
  );

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    const point = localPoint(event);
    if (point) {
      setMousePos({ x: point.x, y: point.y });
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredNodeIndex(null);
    setHoveredLinkIndex(null);
    setTooltipData(null);
    setMousePos(null);
  }, [setHoveredNodeIndex]);

  const contextValue = {
    graph,
    nodes: graph.nodes,
    links: graph.links,
    width,
    height,
    innerWidth,
    innerHeight,
    margin,
    hoveredNodeIndex,
    hoveredLinkIndex,
    setHoveredNodeIndex,
    setHoveredLinkIndex,
    tooltipData,
    setTooltipData,
    containerRef,
    isLoaded,
    animationDuration,
    enterTransition,
    revealEpoch,
    mousePos,
    createPath,
  };

  return (
    <SankeyProvider value={contextValue}>
      <div className="relative h-full w-full" ref={containerRef}>
        <svg
          aria-hidden="true"
          height={height}
          onMouseLeave={handleMouseLeave}
          onMouseMove={handleMouseMove}
          width={width}
        >
          <g transform={`translate(${margin.left},${margin.top})`}>
            {children}
          </g>
        </svg>
      </div>
    </SankeyProvider>
  );
});

export function SankeyChart({
  data,
  margin: marginProp,
  animationDuration = 1100,
  enterTransition,
  revealSignature,
  aspectRatio = "2 / 1",
  nodeWidth = 16,
  nodePadding = 24,
  justifyBounds = true,
  className = "",
  children,
  hoveredNodeIndex,
  onNodeHoverChange,
}: SankeyChartProps) {
  const margin = { ...DEFAULT_MARGIN, ...marginProp };

  return (
    <div className={cn("relative w-full h-full min-h-[180px]", className)} style={aspectRatio ? { aspectRatio } : undefined}>
      <ParentSize>
        {({ width, height }) => (
          <SankeyChartInner
            animationDuration={animationDuration}
            data={data}
            enterTransition={enterTransition}
            height={height}
            hoveredNodeIndexProp={hoveredNodeIndex}
            justifyBounds={justifyBounds}
            margin={margin}
            nodePadding={nodePadding}
            nodeWidth={nodeWidth}
            onNodeHoverChange={onNodeHoverChange}
            revealSignature={revealSignature}
            width={width}
          >
            {children}
          </SankeyChartInner>
        )}
      </ParentSize>
    </div>
  );
}

SankeyChart.displayName = "SankeyChart";

export default SankeyChart;
