"use client";

import { arc as arcGenerator } from "@visx/shape";
import { motion, useTransform } from "motion/react";
import { memo } from "react";
import { usePieHover, usePieStable } from "./pie-context";
import { useEnterComplete } from "./use-enter-complete";
import { useMountProgress } from "./use-mount-progress";
import { useTheme } from "@/hooks/useTheme";

// Helper to generate arc path using d3 arc generator
function generateArcPath(
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
  cornerRadius: number,
  padAngle: number
): string {
  const generator = arcGenerator<unknown>({
    innerRadius,
    outerRadius,
    cornerRadius,
    padAngle,
  });
  return generator({ startAngle, endAngle } as unknown as null) || "";
}

// Calculate the translation offset for a slice to "pop out" along its radial axis
function getSliceOffset(
  startAngle: number,
  endAngle: number,
  distance: number
): { x: number; y: number } {
  const midAngle = (startAngle + endAngle) / 2;
  return {
    x: Math.sin(midAngle) * distance,
    y: -Math.cos(midAngle) * distance,
  };
}

/** Hover effect types */
export type PieSliceHoverEffect = "translate" | "none";

export interface PieSliceProps {
  /** Index of the slice in the data array */
  index: number;
  /** Optional color override - falls back to data color or palette */
  color?: string;
  /** Optional fill override for patterns/gradients (e.g., "url(#patternId)") */
  fill?: string;
  /** Animate the slice on mount. Default: true */
  animate?: boolean;
  /**
   * Hover effect type. Default: "translate"
   * - "translate": Slice moves outward along its radial axis
   * - "none": No hover animation
   */
  hoverEffect?: PieSliceHoverEffect;
  /** Distance in pixels for hover effect. Defaults to PieChart's hoverOffset */
  hoverOffset?: number;
  /** Additional CSS class */
  className?: string;
  /** Show numeric value badge pills on slices. Defaults to context showBadge or false */
  showBadge?: boolean;
  /** Custom badge text override (defaults to data.value) */
  badgeText?: string;
}

interface AnimatedSliceTranslateProps {
  index: number;
  innerRadius: number;
  outerRadius: number;
  trackOuterRadius: number;
  showTrack: boolean;
  startAngle: number;
  endAngle: number;
  cornerRadius: number;
  padAngle: number;
  fill: string;
  isHovered: boolean;
  isFaded: boolean;
  animationKey: number;
  hoverOffset: number;
  showBadge?: boolean;
  badgeText?: string;
}

function AnimatedSliceTranslate({
  index,
  innerRadius,
  outerRadius,
  trackOuterRadius,
  showTrack,
  startAngle,
  endAngle,
  cornerRadius,
  padAngle,
  fill,
  isHovered,
  isFaded,
  animationKey,
  hoverOffset,
  showBadge = false,
  badgeText,
}: AnimatedSliceTranslateProps) {
  const {
    enterTransition,
    enterStaggerScale,
    animationKey: pieAnimationKey,
  } = usePieStable();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const animationDelay = (0.1 + index * 0.08) * enterStaggerScale;
  const mountProgress = useMountProgress(
    enterTransition,
    animationDelay,
    pieAnimationKey
  );
  const enterComplete = useEnterComplete(mountProgress);

  const animatedSlicePath = useTransform(mountProgress, (mount) => {
    const currentEndAngle = startAngle + (endAngle - startAngle) * mount;
    if (currentEndAngle <= startAngle + 0.01) {
      return "";
    }
    return generateArcPath(
      innerRadius,
      outerRadius,
      startAngle,
      currentEndAngle,
      cornerRadius,
      padAngle
    );
  });

  const badgeOpacity = useTransform(mountProgress, [0.65, 1], [0, 1]);

  const offset = getSliceOffset(startAngle, endAngle, hoverOffset);

  const slicePath = generateArcPath(
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    cornerRadius,
    padAngle
  );

  const trackPath = generateArcPath(
    innerRadius,
    trackOuterRadius,
    startAngle,
    endAngle,
    cornerRadius,
    padAngle
  );

  // Calculate badge positioning centered radially and angularly in the sector
  const midAngle = (startAngle + endAngle) / 2;
  const badgeRadius = innerRadius + (outerRadius - innerRadius) * 0.58;
  const badgeCenterX = Math.sin(midAngle) * badgeRadius;
  const badgeCenterY = -Math.cos(midAngle) * badgeRadius;

  const textStr = badgeText ?? "";
  const badgeW = textStr.length <= 1 ? 24 : textStr.length === 2 ? 28 : 34;
  const badgeH = 22;
  const badgeRx = 6;
  const badgeX = badgeCenterX - badgeW / 2;
  const badgeY = badgeCenterY - badgeH / 2;

  const badgeElement =
    showBadge && badgeText ? (
      <g className="pie-slice-badge select-none pointer-events-none">
        <rect
          fill={isDark ? "rgba(0, 0, 0, 0.28)" : "rgba(255, 255, 255, 0.55)"}
          height={badgeH}
          rx={badgeRx}
          stroke={isDark ? "rgba(255, 255, 255, 0.18)" : "rgba(0, 0, 0, 0.10)"}
          strokeWidth={0.75}
          width={badgeW}
          x={badgeX}
          y={badgeY}
        />
        <text
          className={`font-sans text-[12px] tracking-[-0.015em] select-none pointer-events-none ${
            isDark
              ? "font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]"
              : "font-bold"
          }`}
          dominantBaseline="central"
          fill={isDark ? "#ffffff" : "#09090b"}
          textAnchor="middle"
          x={badgeCenterX}
          y={badgeCenterY + 0.5}
        >
          {badgeText}
        </text>
      </g>
    ) : null;

  if (enterComplete) {
    const shouldTranslate = isHovered;
    return (
      <motion.g
        animate={{
          opacity: isFaded ? 0.35 : 1,
          x: shouldTranslate ? offset.x : 0,
          y: shouldTranslate ? offset.y : 0,
        }}
        pointerEvents="none"
        transition={{
          opacity: { duration: 0.15 },
          x: { type: "spring", stiffness: 400, damping: 25 },
          y: { type: "spring", stiffness: 400, damping: 25 },
        }}
      >
        {showTrack && (
          <path
            d={trackPath}
            className="fill-black/[0.08] dark:fill-white/[0.08]"
          />
        )}
        <path d={slicePath} fill={fill} />
        {badgeElement}
      </motion.g>
    );
  }

  return (
    <motion.g
      animate={{
        opacity: isFaded ? 0.35 : 1,
        x: isHovered ? offset.x : 0,
        y: isHovered ? offset.y : 0,
      }}
      key={`slice-${animationKey}-${index}`}
      pointerEvents="none"
      transition={{
        opacity: { duration: 0.15 },
        x: { type: "spring", stiffness: 400, damping: 25 },
        y: { type: "spring", stiffness: 400, damping: 25 },
      }}
    >
      {showTrack && (
        <path
          d={trackPath}
          className="fill-black/[0.08] dark:fill-white/[0.08]"
        />
      )}
      <motion.path d={animatedSlicePath} fill={fill} />
      {badgeElement && (
        <motion.g style={{ opacity: badgeOpacity }}>
          {badgeElement}
        </motion.g>
      )}
    </motion.g>
  );
}

export const PieSlice = memo(function PieSlice({
  index,
  color: colorProp,
  fill: fillProp,
  animate = true,
  hoverEffect = "translate",
  hoverOffset: hoverOffsetProp,
  showBadge: showBadgeProp,
  badgeText: badgeTextProp,
}: PieSliceProps) {
  const {
    arcs,
    innerRadius,
    outerRadius,
    cornerRadius,
    hoverOffset: contextHoverOffset,
    animationKey,
    geometryScrubbing,
    scrubSlicePaths,
    getColor,
    getFill,
    getSliceOuterRadius,
    showTrack = false,
    showBadge: contextShowBadge,
  } = usePieStable();
  const { hoveredIndex, setHoveredIndex } = usePieHover();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Full radius for background track
  const trackOuterRadius = outerRadius;

  // Dynamic radius for colored petal (rose / polar chart)
  const sliceOuterRadius = getSliceOuterRadius ? getSliceOuterRadius(index) : outerRadius;

  // Use prop if provided, otherwise use context value
  const hoverOffset = hoverOffsetProp ?? contextHoverOffset;

  const arcData = arcs[index];
  if (!arcData) {
    return null;
  }

  const showBadge = showBadgeProp ?? contextShowBadge ?? false;
  const defaultBadgeText =
    arcData.data?.value !== undefined ? String(arcData.data.value) : undefined;
  const badgeText = badgeTextProp ?? defaultBadgeText;

  const color = colorProp || getColor(index);
  const fill = fillProp || getFill(index);

  if (geometryScrubbing) {
    const scrubPath = scrubSlicePaths?.[index];
    if (!scrubPath) {
      return null;
    }
    return <path d={scrubPath} fill={fill} pointerEvents="none" />;
  }

  const isHovered = hoveredIndex === index;
  const isFaded = hoveredIndex !== null && hoveredIndex !== index;

  // Calculate translation offset
  const offset = getSliceOffset(
    arcData.startAngle,
    arcData.endAngle,
    hoverOffset
  );

  // Full track hitbox covering the entire sector
  const trackHitboxPath = generateArcPath(
    innerRadius,
    trackOuterRadius,
    arcData.startAngle,
    arcData.endAngle,
    cornerRadius,
    arcData.padAngle
  );

  const slicePath = generateArcPath(
    innerRadius,
    sliceOuterRadius,
    arcData.startAngle,
    arcData.endAngle,
    cornerRadius,
    arcData.padAngle
  );

  // Static (non-animated entrance) slice
  const renderStaticSlice = () => {
    const shouldTranslate = hoverEffect !== "none" && isHovered;
    const translateX = shouldTranslate ? offset.x : 0;
    const translateY = shouldTranslate ? offset.y : 0;

    const midAngle = (arcData.startAngle + arcData.endAngle) / 2;
    const badgeRadius = innerRadius + (sliceOuterRadius - innerRadius) * 0.58;
    const badgeCenterX = Math.sin(midAngle) * badgeRadius;
    const badgeCenterY = -Math.cos(midAngle) * badgeRadius;

    const textStr = badgeText ?? "";
    const badgeW = textStr.length <= 1 ? 24 : textStr.length === 2 ? 28 : 34;
    const badgeH = 22;
    const badgeRx = 6;
    const badgeX = badgeCenterX - badgeW / 2;
    const badgeY = badgeCenterY - badgeH / 2;

    const badgeElement =
      showBadge && badgeText ? (
        <g className="pie-slice-badge select-none pointer-events-none">
          <rect
            fill={isDark ? "rgba(0, 0, 0, 0.28)" : "rgba(255, 255, 255, 0.55)"}
            height={badgeH}
            rx={badgeRx}
            stroke={isDark ? "rgba(255, 255, 255, 0.18)" : "rgba(0, 0, 0, 0.10)"}
            strokeWidth={0.75}
            width={badgeW}
            x={badgeX}
            y={badgeY}
          />
          <text
            className={`font-sans text-[12px] tracking-[-0.015em] select-none pointer-events-none ${
              isDark
                ? "font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]"
                : "font-bold"
            }`}
            dominantBaseline="central"
            fill={isDark ? "#ffffff" : "#09090b"}
            textAnchor="middle"
            x={badgeCenterX}
            y={badgeCenterY + 0.5}
          >
            {badgeText}
          </text>
        </g>
      ) : null;

    return (
      <motion.g
        animate={{
          opacity: isFaded ? 0.35 : 1,
          x: translateX,
          y: translateY,
        }}
        pointerEvents="none"
        transition={{
          opacity: { duration: 0.15 },
          x: { type: "spring", stiffness: 400, damping: 25 },
          y: { type: "spring", stiffness: 400, damping: 25 },
        }}
      >
        {showTrack && (
          <path
            d={trackHitboxPath}
            className="fill-black/[0.08] dark:fill-white/[0.08]"
          />
        )}
        <path d={slicePath} fill={fill} />
        {badgeElement}
      </motion.g>
    );
  };

  return (
    <g style={{ cursor: "pointer" }}>
      {/* Invisible hitbox - covers full sector so hovering on grey or color triggers hover */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: SVG path used as hover hitbox for visualization */}
      <path
        d={trackHitboxPath}
        fill="transparent"
        onMouseEnter={() => setHoveredIndex(index)}
        onMouseLeave={() => setHoveredIndex(null)}
      />

      {/* Visible slice - both the grey track and colorful petal translate together without glow */}
      {animate ? (
        <AnimatedSliceTranslate
          animationKey={animationKey}
          cornerRadius={cornerRadius}
          endAngle={arcData.endAngle}
          fill={fill}
          hoverOffset={hoverEffect === "none" ? 0 : hoverOffset}
          index={index}
          innerRadius={innerRadius}
          isFaded={isFaded}
          isHovered={isHovered}
          outerRadius={sliceOuterRadius}
          trackOuterRadius={trackOuterRadius}
          showTrack={showTrack}
          showBadge={showBadge}
          badgeText={badgeText}
          padAngle={arcData.padAngle}
          startAngle={arcData.startAngle}
        />
      ) : (
        renderStaticSlice()
      )}
    </g>
  );
});

PieSlice.displayName = "PieSlice";

export default PieSlice;
