import * as React from "react";
import { cn } from "@/lib/utils";

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  variant?: "default" | "card";
}

function TableContainer({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "card" }) {
  return (
    <div
      className={cn("relative w-full overflow-x-auto", className)}
      data-slot="table-container"
      data-variant={variant}
      {...props}
    />
  );
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, variant, ...props }, ref) => (
    <TableContainer variant={variant} className={className}>
      <table
        ref={ref}
        className={cn(
          "w-full caption-bottom text-sm",
          variant === "card"
            ? "in-data-[variant=card]:border-separate in-data-[variant=card]:border-spacing-0 table-fixed"
            : "border-separate border-spacing-0",
        )}
        data-slot="table"
        {...props}
      />
    </TableContainer>
  ),
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead
      ref={ref}
      className={cn("[&_tr]:border-b", className)}
      data-slot="table-header"
      {...props}
    />
  ),
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody
      ref={ref}
      className={cn(
        "relative",
        // Card variant styles — exact copy from Coss UI registry
        "in-data-[variant=card]:rounded-xl in-data-[variant=card]:shadow-xs/5",
        "before:pointer-events-none before:absolute before:inset-px not-in-data-[variant=card]:before:hidden before:rounded-[calc(var(--radius-xl)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/8%)]",
        "[&_tr:last-child]:border-0",
        // Card variant: border on individual cells, bg-card, rounded corners on extremes
        "in-data-[variant=card]:*:[tr]:border-0",
        "in-data-[variant=card]:*:[tr]:*:[td]:border-b",
        "in-data-[variant=card]:*:[tr]:*:[td]:bg-card",
        "in-data-[variant=card]:*:[tr]:first:*:[td]:first:rounded-ss-xl",
        "in-data-[variant=card]:*:[tr]:*:[td]:first:border-s",
        "in-data-[variant=card]:*:[tr]:first:*:[td]:border-t",
        "in-data-[variant=card]:*:[tr]:last:*:[td]:last:rounded-ee-xl",
        "in-data-[variant=card]:*:[tr]:*:[td]:last:border-e",
        "in-data-[variant=card]:*:[tr]:first:*:[td]:last:rounded-se-xl",
        "in-data-[variant=card]:*:[tr]:last:*:[td]:first:rounded-es-xl",
        // Card variant hover and selection
        "in-data-[variant=card]:*:[tr]:hover:*:[td]:bg-[color-mix(in_srgb,var(--card),var(--color-black)_2%)]",
        "in-data-[variant=card]:*:[tr]:data-[state=selected]:*:[td]:bg-[color-mix(in_srgb,var(--card),var(--color-black)_4%)]",
        "dark:in-data-[variant=card]:*:[tr]:data-[state=selected]:*:[td]:bg-[color-mix(in_srgb,var(--card),var(--color-white)_4%)]",
        "dark:in-data-[variant=card]:*:[tr]:hover:*:[td]:bg-[color-mix(in_srgb,var(--card),var(--color-white)_2%)]",
        className,
      )}
      data-slot="table-body"
      {...props}
    />
  ),
);
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot
      ref={ref}
      className={cn("border-t border-input bg-muted/50 font-medium [&>tr]:last:border-b-0", className)}
      data-slot="table-footer"
      {...props}
    />
  ),
);
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        "relative border-b",
        "not-in-data-[variant=card]:hover:bg-[color-mix(in_srgb,var(--background),var(--color-black)_2%)]",
        "not-in-data-[variant=card]:data-[state=selected]:bg-[color-mix(in_srgb,var(--background),var(--color-black)_4%)]",
        "dark:not-in-data-[variant=card]:data-[state=selected]:bg-[color-mix(in_srgb,var(--background),var(--color-white)_4%)]",
        "dark:not-in-data-[variant=card]:hover:bg-[color-mix(in_srgb,var(--background),var(--color-white)_2%)]",
        className,
      )}
      data-slot="table-row"
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "h-12 whitespace-nowrap px-2.5 text-left align-middle font-medium text-muted-foreground leading-none has-[[role=checkbox]]:w-px last:has-[[role=checkbox]]:ps-0 first:has-[[role=checkbox]]:pe-0",
        "in-data-[variant=card]:first:rounded-ss-2xl in-data-[variant=card]:last:rounded-se-2xl",
        "in-data-[variant=card]:first:ps-[calc(--spacing(2.5)-1px)] in-data-[variant=card]:last:pe-[calc(--spacing(2.5)-1px)]",
        className,
      )}
      data-slot="table-head"
      {...props}
    />
  ),
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={cn(
        "whitespace-nowrap bg-clip-padding p-2.5 in-data-[slot=table-footer]:py-3.5 align-middle leading-none in-data-[variant=card]:first:ps-[calc(--spacing(2.5)-1px)] in-data-[variant=card]:last:pe-[calc(--spacing(2.5)-1px)] has-[[role=checkbox]]:w-px last:has-[[role=checkbox]]:ps-0 first:has-[[role=checkbox]]:pe-0",
        className,
      )}
      data-slot="table-cell"
      {...props}
    />
  ),
);
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption
      ref={ref}
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      data-slot="table-caption"
      {...props}
    />
  ),
);
TableCaption.displayName = "TableCaption";

export { Table, TableContainer, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
