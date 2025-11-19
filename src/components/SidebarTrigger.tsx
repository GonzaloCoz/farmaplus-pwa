import { Menu } from "lucide-react";
import { useSidebar } from "@/components/SidebarProvider";

export function SidebarTrigger() {
  const { state, setState } = useSidebar();

  const handleClick = () => {
    setState(state === "expanded" ? "collapsed" : "expanded");
  };

  return (
    <button onClick={handleClick} className="p-2">
      <Menu className="w-5 h-5 text-muted-foreground group-hover:text-primary-foreground" />
    </button>
  );
}