import { useState } from "react";
import { Home, Upload, BarChart3, Package, FileText, Settings, User, Bell, LucideIcon, TrendingUp, Archive, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const menuItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Stock", url: "/stock", icon: Upload },
  { title: "Inventarios Cíclicos", url: "/cyclic-inventory", icon: BarChart3 },
  { title: "Comparativa", url: "/comparison", icon: TrendingUp },
  { title: "Productos", url: "/products", icon: Package },
  { title: "Reportes", url: "/reports", icon: FileText },
];

interface AppSidebarMenuItemProps {
  item: {
    title: string;
    url: string;
    icon: LucideIcon;
    notification?: boolean;
  };
  end?: boolean;
  isCollapsed: boolean;
}

function AppSidebarMenuItem({ item, end, isCollapsed }: AppSidebarMenuItemProps) {
  const content = (
    <NavLink
      to={item.url}
      end={end}
      aria-label={item.title}
      className={({ isActive }) => cn(
        "group flex items-center h-10 transition-all duration-300 rounded-xl outline-none border-none ring-0 w-full !bg-transparent !shadow-none !ring-transparent",
        isActive
          ? "text-primary"
          : "text-gray-500 dark:text-zinc-400 hover:text-black dark:hover:text-white"
      )}
    >
      {({ isActive }) => (
        <>
          {/* Constant size and position container for the icon - Matches the toggle button dimensions exactly */}
          <div className="w-12 h-10 flex items-center justify-center shrink-0">
            <item.icon className={cn(
              "h-5 w-5 transition-transform duration-300",
              isActive && "scale-110"
            )} />
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
                  isActive ? "text-black dark:text-white" : "text-gray-600 dark:text-zinc-400 group-hover:text-black dark:group-hover:text-white"
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
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            {/* When collapsed, we can restrict the NavLink width if desired, but centering is safer */}
            <div className="w-12 h-10">
              {content}
            </div>
          </TooltipTrigger>
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
            <div className="h-[2px] w-4 bg-gray-300 dark:bg-zinc-800 rounded-full" />
          </div>
          {!isCollapsed && (
            <motion.h2
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[10px] font-black text-gray-400/80 uppercase tracking-[0.2em] whitespace-nowrap ml-1"
            >
              Menu
            </motion.h2>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 flex flex-col gap-1 overflow-x-hidden overflow-y-auto no-scrollbar">
          {menuItems.map((item) => (
            <AppSidebarMenuItem
              key={item.title}
              item={item}
              end={item.url === '/'}
              isCollapsed={isCollapsed}
            />
          ))}
        </nav>

        {/* Toggle Button - Perfectly aligned on the same w-12 grid */}
        <div className="h-14 w-full flex items-center px-1 mt-auto">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-12 h-10 flex items-center justify-center transition-colors duration-300 outline-none focus:outline-none focus:ring-0 !border-none !bg-transparent !shadow-none text-gray-400 hover:text-black dark:hover:text-white"
          >
            <ChevronLeft className={cn("h-5 w-5 transition-transform duration-400", isCollapsed && "rotate-180")} />
          </button>
        </div>
      </div>
    </motion.aside>
  );
}
