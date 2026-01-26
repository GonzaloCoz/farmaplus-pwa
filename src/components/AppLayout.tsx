import { AppSidebar } from "@/components/AppSidebar";
import { BottomNavBar } from "../BottomNavBar";
import { TopAppBar } from "@/components/TopAppBar";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { SyncStatus } from './SyncStatus';
import { DesktopHeader } from "@/components/DesktopHeader";
import { useWindowManager } from "@/contexts/WindowManagerContext";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { WindowRouter } from "@/components/WindowRouter";
import { getTabMetaForPath } from "@/config/tabConfig";

export function AppLayout() {
  const { windows, activeWindowId, updateWindowPath, updateWindowMeta } = useWindowManager();
  const location = useLocation();
  const globalNavigate = useNavigate();

  // Sync global URL and win metadata to active window path when global URL changes
  useEffect(() => {
    if (activeWindowId) {
      const activeWindow = windows.find(w => w.id === activeWindowId);
      if (activeWindow && activeWindow.path !== location.pathname) {
        const { title, icon } = getTabMetaForPath(location.pathname);
        updateWindowPath(activeWindowId, location.pathname);
        updateWindowMeta(activeWindowId, title, icon);
      }
    }
  }, [location.pathname, activeWindowId, updateWindowPath, updateWindowMeta]);

  const handleWindowPathChange = (winId: string, newPath: string) => {
    // Update context state
    updateWindowPath(winId, newPath);

    // If it's the active window, sync to global URL
    if (winId === activeWindowId && location.pathname !== newPath) {
      globalNavigate(newPath);
    }
  };

  return (
    <div className="flex h-screen w-full bg-muted/40 overflow-hidden">
      <AppSidebar />
      <div className="flex-1 h-full relative p-2 lg:ml-[72px]">
        <div className="relative h-full w-full bg-background rounded-[2rem] shadow-md border border-border/50 overflow-hidden flex flex-col">
          <div className="hidden lg:block">
            <DesktopHeader />
          </div>
          <main id="main-content" className="flex-1 overflow-y-auto w-full relative">
            <div className="lg:hidden h-16" /> {/* Spacer for mobile TopAppBar */}
            <div className="max-w-7xl mx-auto w-full h-full relative">
              {/* Render windows as isolated instances */}
              {windows.map((win) => (
                <div
                  key={win.id}
                  className={cn(
                    "absolute inset-0 w-full h-full overflow-y-auto transition-opacity duration-300",
                    activeWindowId === win.id ? "opacity-100 z-10" : "opacity-0 pointer-events-none z-0"
                  )}
                >
                  <WindowRouter
                    initialPath={win.path}
                    currentPath={win.path}
                    onPathChange={() => { }} // No-op, sync handled by useEffect
                  />
                </div>
              ))}

              {/* Fallback for cases where no windows exist yet */}
              {windows.length === 0 && <Outlet />}
            </div>
          </main>
          <div className="sticky bottom-0 z-10">
            <BottomNavBar />
          </div>
          <TopAppBar />
          <SyncStatus />
        </div>
      </div>
    </div>
  );
}
