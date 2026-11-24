import * as React from "react";
import { notify, sileo } from "@/lib/notifications";

function toastFn(props: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "destructive";
  action?: React.ReactNode;
  [key: string]: any;
}) {
  const { title, description, variant, action } = props;
  const titleStr = typeof title === 'string' ? title : String(title || '');
  const descStr = typeof description === 'string' ? description : description ? String(description) : undefined;
  
  const options: any = { description: descStr };
  
  if (action && React.isValidElement(action)) {
    const actionElement = action as React.ReactElement<any>;
    const onClick = actionElement.props.onClick || (() => {});
    const label = typeof actionElement.props.children === 'string' 
      ? actionElement.props.children 
      : (actionElement.props.altText || "Action");
      
    options.action = { label, onClick };
  }

  if (variant === "destructive") {
    return notify.error(titleStr, descStr, options);
  }
  return notify.info(titleStr, descStr, options);
}

export const toast = Object.assign(toastFn, notify);

export function useToast() {
  return {
    toast,
    dismiss: (toastId?: string | number) => sileo.dismiss(toastId ? String(toastId) : (undefined as any)),
    toasts: []
  };
}
