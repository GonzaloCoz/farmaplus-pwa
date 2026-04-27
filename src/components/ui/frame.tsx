import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Frame: A framed container for grouping related information.
 */
export function Frame({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-lg bg-muted/20 p-1 dark:ring-1 dark:ring-inset dark:ring-border/10",
        "*:[[data-slot=frame-panel]+[data-slot=frame-panel]]:mt-1",
        className,
      )}
      data-slot="frame"
      {...props}
    />
  );
}

/**
 * FramePanel: A panel container for frame content.
 */
export function FramePanel({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn(
        "relative rounded-xl border border-input bg-card bg-clip-padding p-5 shadow-sm shadow-black/5 transition-all dark:bg-input/20",
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit]",
        "before:shadow-[0_1px_rgba(0,0,0,0.04)] dark:before:shadow-[0_-1px_rgba(255,255,255,0.06)]",
        className,
      )}
      data-slot="frame-panel"
      {...props}
    />
  );
}

/**
 * FrameHeader: Header section for the frame.
 */
export function FrameHeader({
  className,
  ...props
}: React.ComponentProps<"header">): React.ReactElement {
  return (
    <header
      className={cn("flex flex-col px-5 py-4", className)}
      data-slot="frame-header"
      {...props}
    />
  );
}

/**
 * FrameTitle: Title text for the frame header.
 */
export function FrameTitle({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn("font-semibold text-sm leading-none tracking-tight", className)}
      data-slot="frame-title"
      {...props}
    />
  );
}

/**
 * FrameDescription: Description text for the frame header.
 */
export function FrameDescription({
  className,
  ...props
}: React.ComponentProps<"p">): React.ReactElement {
  return (
    <p
      className={cn("text-muted-foreground text-xs", className)}
      data-slot="frame-description"
      {...props}
    />
  );
}

/**
 * FrameFooter: Footer section for the frame.
 */
export function FrameFooter({
  className,
  ...props
}: React.ComponentProps<"footer">): React.ReactElement {
  return (
    <footer
      className={cn("flex items-center px-5 py-4", className)}
      data-slot="frame-footer"
      {...props}
    />
  );
}

