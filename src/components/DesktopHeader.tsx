import { useState } from "react";
import { WindowTabs } from "@/components/WindowTabs";
import { SuperSearch } from "@/components/SuperSearch";
import { cn } from "@/lib/utils";

export function DesktopHeader() {
    const [searchOpen, setSearchOpen] = useState(false);
    const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

    return (
        <>
            <header 
                className={cn(
                    "h-12 bg-transparent sticky top-0 z-30 transition-all flex items-center py-1",
                    isElectron && "select-none"
                )}
                style={isElectron ? { WebkitAppRegion: 'drag' } as React.CSSProperties : undefined}
            >
                <div className="w-full h-full">
                    <WindowTabs onSearchClick={() => setSearchOpen(true)} />
                </div>
            </header>

            {/* Global Search Command Palette */}
            <SuperSearch open={searchOpen} onOpenChange={setSearchOpen} />
        </>
    );
}
