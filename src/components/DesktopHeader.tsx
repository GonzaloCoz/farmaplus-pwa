import { WindowTabs } from "@/components/WindowTabs";
import { cn } from "@/lib/utils";
import { TrainingCenterButton } from "./TrainingCenterButton";
import { NotificationsMenu } from "@/components/HeaderMenus";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { Button } from "@/components/ui/button";
import { Minus, Square, XClose as XIcon } from '@untitledui/icons';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function DesktopHeader() {
    const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

    const triggerSearch = () => {
        window.dispatchEvent(new CustomEvent("open-command-palette"));
    };

    const handleMinimize = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isTauri) {
            try {
                const appWindow = getCurrentWindow();
                await appWindow.minimize();
            } catch (err) {
                console.error("Minimize error:", err);
            }
        }
    };

    const handleMaximize = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isTauri) {
            try {
                const appWindow = getCurrentWindow();
                await appWindow.toggleMaximize();
            } catch (err) {
                console.error("Maximize error:", err);
            }
        }
    };

    const handleClose = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isTauri) {
            try {
                const appWindow = getCurrentWindow();
                await appWindow.close();
            } catch (err) {
                console.error("Close error:", err);
            }
        }
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

    return (
        <header 
            data-tauri-drag-region
            onMouseDown={handleHeaderMouseDown}
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
                        <div className="flex items-center gap-0.5 shrink-0">
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={handleMinimize}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground h-7 w-7 rounded-lg"
                                title="Minimizar"
                            >
                                <Minus className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={handleMaximize}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground h-7 w-7 rounded-lg"
                                title="Maximizar / Restaurar"
                            >
                                <Square className="w-3 h-3" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={handleClose}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="shrink-0 cursor-pointer text-muted-foreground hover:bg-red-500 hover:text-white h-7 w-7 rounded-lg transition-colors"
                                title="Cerrar"
                            >
                                <XIcon className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </header>
    );
}
