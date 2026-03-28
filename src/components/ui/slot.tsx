import * as React from "react";
import { cn } from "@/lib/utils";

function composeRefs<T>(...refs: (React.Ref<T> | undefined)[]) {
  return (node: T) => refs.forEach((ref) => {
    if (typeof ref === "function") {
      ref(node);
    } else if (ref != null) {
      (ref as React.MutableRefObject<T>).current = node;
    }
  });
}

export const Slot = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }>(
  ({ children, ...props }, ref) => {
    if (React.isValidElement(children)) {
      return React.cloneElement(children, {
        ...props,
        ...children.props,
        ref: composeRefs(ref, (children as any).ref),
        className: cn(props.className, (children.props as any).className)
      } as any);
    }
    return null;
  }
);
Slot.displayName = "Slot";
