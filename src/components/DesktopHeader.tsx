import { useState } from "react";
import { WindowTabs } from "@/components/WindowTabs";
import { SuperSearch } from "@/components/SuperSearch";
import { cn } from "@/lib/utils";
import { TrainingCenterButton } from "./TrainingCenterButton";
import { NotificationsMenu } from "@/components/HeaderMenus";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { Button } from "@/components/ui/button";
import { Minus, Square, XClose as XIcon } from '@untitledui/icons';

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
                {/* Left and Center: Navigation and Tabs */}
                <div className="flex-1 h-full min-w-0">
                    <WindowTabs onSearchClick={() => setSearchOpen(true)} />
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-1.5 ml-4 shrink-0 pr-2">
                    <TrainingCenterButton />
                    <NotificationsMenu />
                    <div className="w-[1px] h-4 bg-border/40 mx-1" />
                    <ProfileDropdown />
                    
                    {isElectron && (
                        <>
                            <div className="w-[1px] h-4 bg-border/40 mx-1 shrink-0" />
                            <div className="flex items-center gap-1 shrink-0">
                                <Button
                                    variant="ghost"
                                    size="icon-lg"
                                    onClick={() => (window as any).electronAPI.minimize()}
                                    className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
                                    style={isElectron ? { WebkitAppRegion: 'no-drag' } as React.CSSProperties : undefined}
                                    title="Minimizar"
                                >
                                    <Minus className="w-5 h-5" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon-lg"
                                    onClick={() => (window as any).electronAPI.maximize()}
                                    className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
                                    style={isElectron ? { WebkitAppRegion: 'no-drag' } as React.CSSProperties : undefined}
                                    title="Maximizar"
                                >
                                    <Square className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon-lg"
                                    onClick={() => (window as any).electronAPI.close()}
                                    className="shrink-0 cursor-pointer text-muted-foreground hover:bg-red-600 hover:text-white"
                                    style={isElectron ? { WebkitAppRegion: 'no-drag' } as React.CSSProperties : undefined}
                                    title="Cerrar"
                                >
                                    <XIcon className="w-5 h-5" />
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </header>

            {/* Global Search Command Palette */}
            <SuperSearch open={searchOpen} onOpenChange={setSearchOpen} />
        </>
    );
}
