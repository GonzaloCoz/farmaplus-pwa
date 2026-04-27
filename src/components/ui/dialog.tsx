import * as React from "react";
import { Dialog as BaseDialog } from "@base-ui-components/react/dialog";
import { CloseCircle as X } from "@solar-icons/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/**
 * Root Dialog component.
 */
const Dialog = BaseDialog.Root;

/**
 * Trigger button that opens the dialog.
 */
const DialogTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof BaseDialog.Trigger> & { render?: React.ReactElement }
>(({ render, ...props }, ref) => (
  <BaseDialog.Trigger ref={ref} render={render} {...props} />
));
DialogTrigger.displayName = "DialogTrigger";

/**
 * Portal for rendering out of DOM hierarchy.
 */
const DialogPortal = BaseDialog.Portal;

/**
 * Create handle for detached triggers.
 */
const DialogCreateHandle = BaseDialog.createHandle;

/**
 * Backdrop / Overlay component.
 */
const DialogOverlay = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof BaseDialog.Backdrop>
>(({ className, ...props }, ref) => (
  <BaseDialog.Backdrop
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = "DialogOverlay";
const DialogBackdrop = DialogOverlay;

/**
 * Viewport for positioning.
 */
const DialogViewport = BaseDialog.Viewport;

/**
 * Main Popup container.
 */
interface DialogPopupProps extends React.ComponentPropsWithoutRef<typeof BaseDialog.Popup> {
  showCloseButton?: boolean;
  bottomStickOnMobile?: boolean;
  closeProps?: React.ComponentPropsWithoutRef<typeof BaseDialog.Close>;
}

const DialogPopup = React.forwardRef<HTMLDivElement, DialogPopupProps>(
  ({ className, children, showCloseButton = true, bottomStickOnMobile = true, closeProps, ...props }, ref) => (
    <BaseDialog.Portal>
      <DialogOverlay />
      <BaseDialog.Popup
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 flex w-full max-w-lg translate-x-[-50%] translate-y-[-50%] flex-col gap-0 border bg-background shadow-sm transition-all duration-300",
          "data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95 data-[closed]:slide-out-to-left-1/2 data-[closed]:slide-out-to-top-[48%] data-[open]:slide-in-from-left-1/2 data-[open]:slide-in-from-top-[48%]",
          "rounded-xl border-border/40 overflow-hidden",
          bottomStickOnMobile && "max-sm:top-auto max-sm:bottom-4 max-sm:translate-y-0 max-sm:max-w-[calc(100%-2rem)]",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <BaseDialog.Close
            {...closeProps}
            className={cn(
              "absolute right-4 top-4 rounded-full p-1.5 opacity-70 transition-all hover:opacity-100 hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[open]:bg-accent data-[open]:text-muted-foreground",
              closeProps?.className
            )}
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </BaseDialog.Close>
        )}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  )
);
DialogPopup.displayName = "DialogPopup";
const DialogContent = DialogPopup;

/**
 * Header container for title/description.
 */
const DialogHeader = ({
  className,
  render,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { render?: React.ReactElement }) => {
  return (
    <div className={cn("flex flex-col space-y-1.5 p-6 pb-4", className)} {...props}>
      {render ? React.cloneElement(render, props) : children}
    </div>
  );
};
DialogHeader.displayName = "DialogHeader";

/**
 * Title component.
 */
const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.ComponentPropsWithoutRef<typeof BaseDialog.Title>
>(({ className, ...props }, ref) => (
  <BaseDialog.Title
    ref={ref}
    className={cn("text-lg font-black tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

/**
 * Description component.
 */
const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<typeof BaseDialog.Description>
>(({ className, ...props }, ref) => (
  <BaseDialog.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground font-medium", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";

/**
 * Scrollable Panel content.
 */
interface DialogPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  scrollFade?: boolean;
}

const DialogPanel = React.forwardRef<HTMLDivElement, DialogPanelProps>(
  ({ className, children, scrollFade = true, ...props }, ref) => {
    return (
      <div className="relative flex-1 overflow-hidden">
        {scrollFade && (
          <div className="absolute inset-x-0 top-0 z-10 h-4 bg-gradient-to-b from-background to-transparent pointer-events-none" />
        )}
        <ScrollArea className={cn("max-h-[60vh] px-6 py-2 pb-6", className)} ref={ref}>
          {children}
        </ScrollArea>
        {scrollFade && (
          <div className="absolute inset-x-0 bottom-0 z-10 h-4 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        )}
      </div>
    );
  }
);
DialogPanel.displayName = "DialogPanel";

/**
 * Footer for action buttons.
 */
interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "bare";
  render?: React.ReactElement;
}

const DialogFooter = ({
  className,
  variant = "default",
  render,
  children,
  ...props
}: DialogFooterProps) => (
  <div
    className={cn(
      "flex items-center justify-end p-4 px-6 gap-2",
      variant === "default" && "border-t border-border/40 bg-muted/5",
      className
    )}
    {...props}
  >
    {render ? React.cloneElement(render, props) : children}
  </div>
);
DialogFooter.displayName = "DialogFooter";

/**
 * Close component.
 */
const DialogClose = BaseDialog.Close;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogBackdrop,
  DialogClose,
  DialogTrigger,
  DialogPopup,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogCreateHandle,
  DialogViewport,
};

