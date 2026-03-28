import * as React from "react";
import { toast as sonnerToast } from "sonner";

export function toast(props: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "destructive";
  action?: React.ReactNode;
  [key: string]: any;
}) {
  const { title, description, variant, action } = props;
  
  const options: any = { description };
  
  if (action && React.isValidElement(action)) {
    // Attempt to extract text and onClick from ToastAction
    const actionElement = action as React.ReactElement<any>;
    const onClick = actionElement.props.onClick || (() => {});
    // Use children as label if it's a string, otherwise fallback
    const label = typeof actionElement.props.children === 'string' 
      ? actionElement.props.children 
      : (actionElement.props.altText || "Action");
      
    options.action = { label, onClick };
  }

  if (variant === "destructive") {
    return sonnerToast.error(title as string, options);
  }
  return sonnerToast(title as string, options);
}

export function useToast() {
  return {
    toast,
    dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
    toasts: [] // Mock to prevent errors in existing consumers mapping over state
  };
}
