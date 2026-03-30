import { useState, useMemo } from "react";
import { Home, Upload, Chart as BarChart3, Box as Package, Document as FileText, Settings, User, Bell, GraphUp as TrendingUp, Archive, AltArrowLeft as ChevronLeft, ClockCircle as Clock } from "@solar-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea, ScrollAreaViewport, ScrollAreaScrollbar } from "@/components/ui/scroll-area";
import { useUser } from "@/contexts/UserContext";

// roles: si se omite, todos los roles pueden ver el item
const menuItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Stock", url: "/stock", icon: Upload },
  { title: "Control de Vencimiento", url: "/smart-analyst", icon: Clock, comingSoon: true },
  { title: "Inventarios Cíclicos", url: "/cyclic-inventory", icon: BarChart3 },
  { title: "Comparativa", url: "/comparison", icon: TrendingUp, roles: ['admin'] as const },
  { title: "Productos", url: "/products", icon: Package, roles: ['admin'] as const },
  { title: "Reportes", url: "/reports", icon: FileText, roles: ['admin', 'mod'] as const },
];

import { notify } from "@/lib/notifications";

interface AppSidebarMenuItemProps {
  item: {
    title: string;
    url: string;
    icon: React.ComponentType<any>;
    notification?: boolean;
    comingSoon?: boolean;
  };
  end?: boolean;
  isCollapsed: boolean;
  userRole?: string;
}

function AppSidebarMenuItem({ item, end, isCollapsed, userRole }: AppSidebarMenuItemProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (item.comingSoon && (userRole === 'branch' || userRole === 'mod')) {
      e.preventDefault();
      notify.info("Próximamente", "Esta herramienta estará disponible muy pronto.", { id: 'blocked-feature' });
    }
  };

  const content = (
    <NavLink
      to={item.url}
      end={end}
      onClick={handleClick}
      aria-label={item.title}
      className={({ isActive }) => cn(
        "group flex items-center h-10 transition-all duration-300 rounded-xl outline-none border-none ring-0 w-full !bg-transparent !shadow-none !ring-transparent",
        isActive
              ? "bg-[var(--layout-card)] text-foreground shadow-md ring-1 ring-black/[0.02] dark:ring-white/[0.05]"
              : "text-muted-foreground/80 hover:bg-muted hover:text-foreground"
      )}
    >
      {({ isActive }) => (
        <>
          {/* Constant size and position container for the icon - Matches the toggle button dimensions exactly */}
          <div className="w-12 h-10 flex items-center justify-center shrink-0">
            <item.icon
              weight={isActive ? "BoldDuotone" : "LineDuotone"}
              className={cn(
                "h-5 w-5 transition-transform duration-300",
                isActive && "scale-110"
              )}
            />
          </div>

          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={cn(
                  "text-sm font-semibold tracking-tight transition-colors whitespace-nowrap ml-1",
                  isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                )}
              >
                {item.title}
              </motion.span>
            )}
          </AnimatePresence>
        </>
      )}
    </NavLink>
  );

  return (
    <div className="w-full flex justify-start px-1 py-0.5">
      {isCollapsed ? (
        <Tooltip>
          <TooltipTrigger render={
            <div className="w-12 h-10">
              {content}
            </div>
          } />
          <TooltipContent side="right" className="font-semibold" sideOffset={10}>
            {item.title}
          </TooltipContent>
        </Tooltip>
      ) : content}
    </div>
  );
}

export function AppSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const { user } = useUser();

  // Filtrar items del menú según el rol del usuario
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter(item => {
      if (!item.roles) return true; // Sin restricción de roles = visible para todos
      return user?.role ? (item.roles as readonly string[]).includes(user.role) : false;
    });
  }, [user?.role]);

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? "56px" : "240px" }} // Increased slightly from 48px to allow for the px-1 and w-12 safely
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="hidden lg:flex flex-col bg-transparent h-full relative overflow-hidden"
    >
      <div className="flex-1 flex flex-col py-6">
        {/* Header Section - Perfectly Aligned Indicator */}
        <div className="h-10 w-full flex items-center px-1 mb-6">
          <div className="w-12 h-10 flex items-center justify-center shrink-0">
            <div className="h-[2px] w-4 bg-muted-foreground/20 rounded-full" />
          </div>
          {!isCollapsed && (
            <motion.h2
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] whitespace-nowrap ml-1"
            >
              Menu
            </motion.h2>
          )}
        </div>

        {/* Navigation Items */}
        <ScrollArea className="flex-1 overflow-hidden" scrollbarGutter>
          <ScrollAreaViewport className="flex flex-col gap-1 px-1">
            {filteredMenuItems.map((item) => (
              <AppSidebarMenuItem
                key={item.title}
                item={item}
                end={item.url === '/'}
                isCollapsed={isCollapsed}
                userRole={user?.role}
              />
            ))}
          </ScrollAreaViewport>
          <ScrollAreaScrollbar />
        </ScrollArea>

        {/* Toggle Button - Perfectly aligned on the same w-12 grid */}
        <div className="h-14 w-full flex items-center px-1 mt-auto">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-12 h-10 flex items-center justify-center transition-colors duration-300 outline-none focus:outline-none focus:ring-0 !border-none !bg-transparent !shadow-none text-muted-foreground/60 hover:text-foreground"
          >
            <ChevronLeft className={cn("h-5 w-5 transition-transform duration-400", isCollapsed && "rotate-180")} />
          </button>
        </div>
      </div>
    </motion.aside>
  );
}
