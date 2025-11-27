import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface HeaderActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  notification?: boolean;
}

export function HeaderAction({ icon: Icon, notification, className, ...props }: HeaderActionProps) {
  return (
    <button
      className={cn("group p-2 hover:bg-primary rounded-lg transition-colors relative", className)}
      {...props}
    >
      <Icon className="w-5 h-5 text-muted-foreground group-hover:text-primary-foreground" />
      {notification && (
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-warning rounded-full"></span>
      )}
    </button>
  );
}