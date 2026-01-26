import { useState } from "react";
import { WindowTabs } from "@/components/WindowTabs";
import { SuperSearch } from "@/components/SuperSearch";

export function DesktopHeader() {
    const [searchOpen, setSearchOpen] = useState(false);

    return (
        <>
            <header className="h-16 border-b border-border/40 bg-background sticky top-0 z-30">
                <div className="max-w-7xl mx-auto w-full h-full">
                    <WindowTabs onSearchClick={() => setSearchOpen(true)} />
                </div>
            </header>

            {/* Global Search Command Palette */}
            <SuperSearch open={searchOpen} onOpenChange={setSearchOpen} />
        </>
    );
}
