import { WindowTabs } from "@/components/WindowTabs";
import { cn } from "@/lib/utils";
import { TrainingCenterButton } from "./TrainingCenterButton";
import { NotificationsMenu } from "@/components/HeaderMenus";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { WindowControls } from "@/components/WindowControls";
import { getCurrentWindow } from '@tauri-apps/api/window';

export function DesktopHeader() {
    const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

    const triggerSearch = () => {
        window.dispatchEvent(new CustomEvent("open-command-palette"));
    };

    const handleHeaderMouseDown = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, a, input, [role="button"], [data-no-drag]')) {
            return;
        }
        if (e.button === 0 && isTauri) {
            try {
                getCurrentWindow().startDragging();
            } catch (err) {
                console.error("Drag error:", err);
            }
        }
    };

    const handleHeaderDoubleClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, a, input, [role="button"], [data-no-drag]')) {
            return;
        }
        if (isTauri) {
            try {
                getCurrentWindow().toggleMaximize();
            } catch (err) {
                console.error("Toggle maximize error:", err);
            }
        }
    };

    return (
        <header 
            data-tauri-drag-region
            onMouseDown={handleHeaderMouseDown}
            onDoubleClick={handleHeaderDoubleClick}
            className={cn(
                "h-11 bg-transparent sticky top-0 z-30 transition-all flex items-center select-none"
            )}
        >
            {/* Left and Center: Navigation and Tabs */}
            <div className="flex-1 h-full min-w-0 flex items-center" data-tauri-drag-region>
                <WindowTabs onSearchClick={triggerSearch} />
            </div>

            {/* Right Actions & Window Controls */}
            <div 
                data-no-drag 
                onMouseDown={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 shrink-0 pl-2"
            >
                <TrainingCenterButton />
                <NotificationsMenu />
                <div className="w-[1px] h-4 bg-border/40 mx-0.5" />
                <ProfileDropdown />
                
                {isTauri && (
                    <>
                        <div className="w-[1px] h-4 bg-border/40 mx-0.5 shrink-0" />
                        <WindowControls />
                    </>
                )}
            </div>
        </header>
    );
}
