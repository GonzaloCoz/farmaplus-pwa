import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export function Fab({ className, ...props }: FabProps) {
  return (
    <Button
      className={cn(
        "fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-lg sm:bottom-6 sm:right-6",
        className
      )}
      size="icon"
      {...props}
    >
      <Plus className="h-6 w-6" />
    </Button>
  );
}