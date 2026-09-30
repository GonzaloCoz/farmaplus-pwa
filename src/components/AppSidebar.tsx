import { useMemo } from "react";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea, ScrollAreaViewport, ScrollAreaScrollbar } from "@/components/ui/scroll-area";
import { useUser } from "@/contexts/UserContext";
import { notify } from "@/lib/notifications";
import { surfaceClasses } from "@/lib/surface-classes";
import { SIDEBAR_MENU_ITEMS, type NavItemConfig } from "@/config/navigation";

interface AppSidebarMenuItemProps {
  item: {
    title: string;
    url: string;
    icon: React.ComponentType<any>;
    notification?: boolean;
    comingSoon?: boolean;
  };
  end?: boolean;
  userRole?: string;
}

function AppSidebarMenuItem({ item, end, userRole }: AppSidebarMenuItemProps) {
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
        "group flex items-center justify-center h-10 w-10 transition-all duration-300 rounded-xl outline-none border border-transparent ring-0",
        isActive
          ? cn("text-foreground", surfaceClasses(3))
          : "bg-transparent text-muted-foreground/80 hover:bg-muted hover:text-foreground"
      )}
    >
      {({ isActive }) => (
        <item.icon
          weight={isActive ? "BoldDuotone" : "LineDuotone"}
          className={cn(
            "h-[18px] w-[18px] transition-transform duration-300",
            isActive && "scale-110"
          )}
        />
      )}
    </NavLink>
  );

  return (
    <div className="w-full flex justify-center py-1">
      <Tooltip>
        <TooltipTrigger render={
          <div className="w-10 h-10 flex items-center justify-center cursor-pointer">
            {content}
          </div>
        } />
        <TooltipContent side="right" className="font-semibold" sideOffset={10}>
          {item.title}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function AppSidebar() {
  const { user } = useUser();

  const filteredMenuItems = useMemo(() => {
    return SIDEBAR_MENU_ITEMS.filter(item => {
      if ((item as any).onlyUsername) {
        return user?.username?.toLowerCase() === (item as any).onlyUsername;
      }
      if (!item.roles) return true;
      return user?.role ? (item.roles as readonly string[]).includes(user.role) : false;
    });
  }, [user?.role, user?.username]);

  return (
    <aside className="hidden lg:flex flex-col bg-transparent h-full w-[64px] pl-2 relative overflow-hidden">
      <div className="flex-1 flex flex-col pt-[34px] pb-16">
        {/* Navigation Items */}
        <ScrollArea className="flex-1 overflow-hidden">
          <ScrollAreaViewport className="flex flex-col gap-1 px-1">
            {filteredMenuItems.map((item) => (
              <AppSidebarMenuItem
                key={item.title}
                item={item}
                end={item.url === '/'}
                userRole={user?.role}
              />
            ))}
          </ScrollAreaViewport>
          <ScrollAreaScrollbar />
        </ScrollArea>
      </div>
    </aside>
  );
}
