import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { SearchLg as Search } from '@untitledui/icons';
import { Dialog, DialogPopup, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Root Command component.
 */
interface CommandProps extends React.ComponentPropsWithoutRef<typeof CommandPrimitive> {
  items?: any[];
}

const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  CommandProps
>(({ className, items, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      "flex h-full w-full flex-col overflow-hidden rounded-md bg-white dark:bg-zinc-950 text-foreground",
      className
    )}
    {...props}
  />
));
Command.displayName = CommandPrimitive.displayName;

/**
 * Dialog wrapper for Command.
 */
interface CommandDialogProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

const CommandDialog = ({ children, open, onOpenChange }: CommandDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog>
  );
};

const CommandDialogTrigger = DialogTrigger;

const CommandDialogPopup = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DialogPopup>
>(({ className, children, ...props }, ref) => (
  <DialogPopup
    ref={ref}
    className={cn(
      "!rounded-lg max-h-[85vh] overflow-hidden p-0 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.18)] sm:max-w-[650px] border border-zinc-200 dark:border-zinc-800", 
      className
    )}
    showCloseButton={false}
    {...props}
  >
    {children}
  </DialogPopup>
));
CommandDialogPopup.displayName = "CommandDialogPopup";

/**
 * Input field for Command.
 */
const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="flex items-center px-3 border-b border-zinc-100 dark:border-zinc-800" cmdk-input-wrapper="">
    <Search className="mr-2 h-4 w-4 shrink-0 text-[#71717a]" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "flex h-12 w-full rounded-md bg-transparent py-3 text-[14px] outline-none placeholder:text-[#a1a1aa] disabled:cursor-not-allowed disabled:opacity-50 border-none focus:ring-0 font-medium",
        className
      )}
      {...props}
    />
  </div>
));
CommandInput.displayName = CommandPrimitive.Input.displayName;

/**
 * List area for Command results.
 */
const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, children, ...props }, ref) => {
  // Check if children is a function (Coss UI Collection pattern)
  const isFunction = typeof children === "function";
  
  return (
    <CommandPrimitive.List
      ref={ref}
      className={cn("max-h-[450px] overflow-y-auto overflow-x-hidden no-scrollbar px-3 pb-3", className)}
      {...props}
    >
        {isFunction ? null : children}
    </CommandPrimitive.List>
  );
});
CommandList.displayName = CommandPrimitive.List.displayName;

/**
 * Empty state for Command.
 */
const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className="py-12 text-center text-sm font-medium text-muted-foreground"
    {...props}
  />
));
CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

/**
 * Group of items in Command.
 */
interface CommandGroupProps extends React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group> {
  items?: any[];
}

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  CommandGroupProps
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-[#71717a]",
      className
    )}
    {...props}
  />
));
CommandGroup.displayName = CommandPrimitive.Group.displayName;

const CommandGroupLabel = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn("px-2 py-1.5 text-xs font-medium text-[#71717a]", className)} {...props} />
);

/**
 * Individual item in Command.
 */
const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-md px-2 py-1.5 text-sm font-medium outline-none transition-all aria-selected:bg-[#f4f4f5] dark:aria-selected:bg-zinc-800 aria-selected:text-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
      className
    )}
    {...props}
  />
));
CommandItem.displayName = CommandPrimitive.Item.displayName;

/**
 * Shortcut hint for Command items.
 */
const CommandShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn(
        "ml-auto text-xs font-medium text-[#a1a1aa] font-sans flex items-center gap-0.5",
        className
      )}
      {...props}
    />
  );
};
CommandShortcut.displayName = "CommandShortcut";

/**
 * Separator for Command.
 */
const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 h-px bg-zinc-100 dark:bg-zinc-800 my-2", className)}
    {...props}
  />
));
CommandSeparator.displayName = CommandPrimitive.Separator.displayName;

/**
 * Panel container for results area.
 */
const CommandPanel = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn("flex-1 overflow-hidden", className)} {...props} />
);

/**
 * Footer for shortcuts and navigation.
 */
const CommandFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div 
        className={cn(
            "flex items-center justify-between p-3 border-t border-zinc-100 dark:border-zinc-800 bg-[#fafafa]/50 dark:bg-zinc-900/50 text-[12px] font-medium text-[#71717a] px-6",
            className
        )} 
        {...props} 
    />
);

/**
 * Helper for rendering collections.
 */
const CommandCollection = ({ children, items }: { items?: any[], children: (item: any, index: number) => React.ReactNode }) => {
    if (!items) return null;
    return <>{items.map((item, index) => children(item, index))}</>;
};

export {
  Command,
  CommandDialog,
  CommandDialogTrigger,
  CommandDialogPopup,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
  CommandPanel,
  CommandFooter,
  CommandCollection
};

