import { useState } from "react";
import { WindowTabs } from "@/components/WindowTabs";
import { SuperSearch } from "@/components/SuperSearch";

export function DesktopHeader() {
    const [searchOpen, setSearchOpen] = useState(false);

    return (
        <>
            <header className="h-16 bg-transparent sticky top-0 z-30 transition-all flex items-center py-2">
                <div className="w-full h-full">
                    <WindowTabs onSearchClick={() => setSearchOpen(true)} />
                </div>
            </header>

            {/* Global Search Command Palette */}
            <SuperSearch open={searchOpen} onOpenChange={setSearchOpen} />
        </>
    );
}
