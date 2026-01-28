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
    <div className="flex h-screen w-full bg-[#dadada] dark:bg-[#0a0a0a] overflow-hidden transition-all duration-500">
      <div className="flex-1 h-full relative p-2 md:p-4 lg:px-6 lg:py-4 xl:px-10 xl:py-6">
        {/* Outer container with #f7f5f6 background */}
        <div className="relative h-full w-full bg-[#f7f5f6] dark:bg-[#1a1a1a] rounded-[2rem] shadow-lg border border-gray-200/30 dark:border-zinc-800 overflow-hidden flex flex-col">
          {/* Header inside outer container */}
          <div className="hidden lg:block px-4 pt-2">
            <DesktopHeader />
          </div>

          {/* Inner container with #f0eeef background - contains sidebar and main content */}
          <div className="flex-1 bg-[#f0eeef] dark:bg-[#2a2a2a] rounded-[1.5rem] mx-4 mb-4 mt-1 overflow-hidden flex p-4 gap-3">
            <AppSidebar />

            {/* White main-content card */}
            <div className="flex-1 bg-white dark:bg-[#1e1e1e] rounded-[1.5rem] shadow-md overflow-hidden flex flex-col">
              <main id="main-content" className="flex-1 overflow-y-auto w-full relative">
                <div className="lg:hidden h-16" /> {/* Spacer for mobile TopAppBar */}
                <div className="w-full h-full relative px-1 md:px-0">
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
            </div>
          </div>

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
