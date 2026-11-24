import * as React from "react";
import { ChevronLeft, ChevronRight } from '@untitledui/icons';

import { cn } from "@/lib/utils";

const Pagination = ({ className, ...props }: React.ComponentProps<"nav">) => (
  <nav
    role="navigation"
    aria-label="Paginación"
    className={cn("mx-auto flex w-full justify-center", className)}
    {...props}
  />
);
Pagination.displayName = "Pagination";

const PaginationContent = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn("flex flex-row items-center gap-1", className)}
    {...props}
  />
));
PaginationContent.displayName = "PaginationContent";

const PaginationItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn("", className)} {...props} />
));
PaginationItem.displayName = "PaginationItem";

type PaginationLinkProps = {
  isActive?: boolean;
  render?: React.ReactElement;
} & React.ComponentProps<"a">;

const PaginationLink = ({
  className,
  isActive,
  render,
  children,
  ...props
}: PaginationLinkProps) => {
  if (render) {
    return React.cloneElement(render, {
      className: cn(render.props.className, className),
      children: children ?? render.props.children,
    });
  }

  return (
    <a
      aria-current={isActive ? "page" : undefined}
      className={cn(className)}
      {...props}
    >
      {children}
    </a>
  );
};
PaginationLink.displayName = "PaginationLink";

const PaginationPrevious = ({
  className,
  render,
  children,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="Página anterior"
    className={cn("gap-1", className)}
    render={render}
    {...props}
  >
    <ChevronLeft className="size-4" />
    <span>{children ?? "Anterior"}</span>
  </PaginationLink>
);
PaginationPrevious.displayName = "PaginationPrevious";

const PaginationNext = ({
  className,
  render,
  children,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="Página siguiente"
    className={cn("gap-1", className)}
    render={render}
    {...props}
  >
    <span>{children ?? "Siguiente"}</span>
    <ChevronRight className="size-4" />
  </PaginationLink>
);
PaginationNext.displayName = "PaginationNext";

export {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};
