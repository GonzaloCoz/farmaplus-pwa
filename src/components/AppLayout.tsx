import { AppSidebar } from "@/components/AppSidebar";
import { BottomNavBar } from "../BottomNavBar";
import { TopAppBar } from "@/components/TopAppBar";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Home, Scanner as Scan, Chart as BarChart2, CheckCircle, User, Widget as Beaker, Box, Layers, Widget as LayoutDashboard, Database, ClipboardList, Widget as Package, Document as FileText, Settings } from "@solar-icons/react";
import { DesktopHeader } from "@/components/DesktopHeader";
import { SyncStatus } from "@/components/SyncStatus";
import { useWindowManager } from "@/contexts/WindowManagerContext";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { WindowRouter } from "@/components/WindowRouter";
import { getTabMetaForPath } from "@/config/tabConfig";
import { ScrollArea, ScrollAreaViewport, ScrollAreaScrollbar } from "@/components/ui/scroll-area";
import { AppUpdater } from "@/components/AppUpdater";
import { Capacitor } from "@capacitor/core";

export function AppLayout() {
  const { windows, activeWindowId } = useWindowManager();
  const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;
  const isNative = Capacitor.isNativePlatform();

  return (
    <div className={cn(
      "isolate relative flex h-screen w-full overflow-hidden transition-all duration-500",
      isElectron ? "bg-transparent" : "bg-[var(--body-bg)]"
    )}>
      <div className={cn("flex-1 h-full relative p-0", !isElectron && "lg:p-2")}>
        {/* Outer container - Flat on mobile, framed on desktop */}
        <div className={cn(
          "relative h-full w-full overflow-hidden flex flex-col",
          isElectron 
            ? "bg-transparent border-none rounded-xl shadow-none" 
            : "bg-[var(--layout-tray)] rounded-none lg:rounded-lg lg:shadow-sm lg:border border-border/40"
        )}>
          {/* Header inside outer container */}
          <div className={cn(
            "hidden lg:block",
            isElectron ? "px-2 pt-1 pb-0" : "px-2 pt-1"
          )}>
            <DesktopHeader />
          </div>

          {/* The Wrapper Box (Behind Sidebar and Content) */}
          <div className="flex-1 bg-[var(--layout-wrapper)] lg:m-2 lg:mt-0 lg:rounded-xl lg:shadow-sm border border-border/5 overflow-hidden flex p-0 gap-0">
            <div className="hidden lg:block">
              <AppSidebar />
            </div>

            {/* Main-content - Top-most Floating Dashboard Box (Framed on Desktop, Full on Mobile) */}
            <div className="flex-1 bg-[var(--layout-content)] lg:m-2.5 lg:rounded-xl lg:border border-black/[0.03] dark:border-white/[0.03] lg:shadow-md overflow-hidden flex flex-col z-10 transition-all duration-300">
              <ScrollArea id="main-content" className="flex-1 w-full relative h-full">
                <ScrollAreaViewport 
                  className="w-full relative lg:px-0 no-scrollbar" 
                >
                  {/* Render windows as isolated instances */}
                  {windows.map((win) => (
                    <div
                      key={win.id}
                      className={cn(
                        "absolute inset-0 w-full h-full transition-opacity duration-300 overflow-y-auto custom-scrollbar md:no-scrollbar",
                        activeWindowId === win.id ? "opacity-100 z-10" : "opacity-0 pointer-events-none z-0"
                      )}
                      style={{ 
                        paddingTop: 'calc(var(--total-header-height) * var(--is-mobile, 1))',
                        paddingLeft: 'var(--safe-left)',
                        paddingRight: 'var(--safe-right)' 
                      }}
                    >
                      <WindowRouter
                        initialPath={win.path}
                        currentPath={win.path}
                        onPathChange={() => { }} // No-op, sync handled by useEffect
                      />
                    </div>
                  ))}

                  {/* Fallback for cases where no windows exist yet */}
                  {windows.length === 0 && <div className="p-4"><Outlet /></div>}
                </ScrollAreaViewport>
                <ScrollAreaScrollbar className="hidden lg:flex" />
              </ScrollArea>
            </div>
          </div>

          <div className="sticky bottom-0 z-10">
            {!isNative && <BottomNavBar />}
          </div>
          {!isNative && <TopAppBar />}
          <SyncStatus />
        </div>
      </div>
      <AppUpdater />
    </div>
  );
}

