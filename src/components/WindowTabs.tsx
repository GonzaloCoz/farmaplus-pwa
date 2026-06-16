import { useLocation, useNavigate } from "react-router-dom";
import { Plus, Undo, Redo, Minus, Square, X as XIcon } from "lucide-react";
import { Magnifer as Search, CloseCircle as X, MenuDots as MoreHorizontal, Widget as LayoutDashboard, Database, ClipboardList, Widget as Package, Document as FileText, Chart as BarChart2, ShieldCheck, Widget as Microscope, TrashBinMinimalistic as Trash2 } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWindowManager } from "@/contexts/WindowManagerContext";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/menu";
import { NotificationsMenu } from "@/components/HeaderMenus";
import { TrainingCenterButton } from "./TrainingCenterButton";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { useUser } from "@/contexts/UserContext";


export function WindowTabs({ onSearchClick }: { onSearchClick: () => void }) {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useUser();
    const { windows, activeWindowId, openWindow, closeWindow, setActiveWindow, closeAllWindows } = useWindowManager();

    const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

    const handleCreateJob = () => {
        openWindow('/', undefined, undefined, true);
    };

    const handleTabClick = (winId: string, path: string) => {
        setActiveWindow(winId);
        navigate(path);
    };

    const handleCloseTab = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        closeWindow(id);
    };

    return (
        <div className="flex items-center w-full h-full gap-1.5 px-2 overflow-hidden bg-transparent">
            {/* Navigation Buttons (Back & Forward) */}
            <button
                onClick={() => window.history.back()}
                className="flex items-center justify-center h-8 w-8 shrink-0 bg-muted/50 border border-border/40 rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Atrás"
                style={isElectron ? { WebkitAppRegion: 'no-drag' } as React.CSSProperties : undefined}
            >
                <Undo className="w-5 h-5" />
            </button>

            <button
                onClick={() => window.history.forward()}
                className="flex items-center justify-center h-8 w-8 shrink-0 bg-muted/50 border border-border/40 rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Adelante"
                style={isElectron ? { WebkitAppRegion: 'no-drag' } as React.CSSProperties : undefined}
            >
                <Redo className="w-5 h-5" />
            </button>

            {/* Search Button */}
            <Button
                variant="secondary"
                className="!h-8 px-3 gap-1.5 shrink-0 rounded-lg font-light text-[13px] transition-colors"
                onClick={onSearchClick}
                style={isElectron ? { WebkitAppRegion: 'no-drag' } as React.CSSProperties : undefined}
            >
                <Search className="w-[18px] h-[18px]" />
                <span>Buscar</span>
            </Button>

            {/* Create Job Button */}
            <Button
                variant="secondary"
                className="!h-8 px-3 gap-1.5 shrink-0 rounded-lg font-light text-[13px] transition-colors"
                onClick={handleCreateJob}
                style={isElectron ? { WebkitAppRegion: 'no-drag' } as React.CSSProperties : undefined}
            >
                <Plus className="w-[18px] h-[18px]" />
                <span>Nueva</span>
            </Button>

            {/* Separator */}
            <div className="w-[1px] h-6 bg-border/40 mx-2 shrink-0" />

            {/* Tabs List */}
            <div 
                className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 mask-linear-fade flex-1"
            >
                {windows.map((win) => {
                    const isActive = activeWindowId === win.id;
                    const isSpecialGreen = win.path === '/inventory-reminder';
                    
                    return (
                        <div
                            key={win.id}
                            className={cn(
                                "group relative flex items-center h-8 px-3 gap-2 rounded-lg transition-all cursor-pointer shrink-0 select-none",
                                isSpecialGreen 
                                    ? "bg-[#0e5e4d] text-white hover:bg-[#0c5041]"
                                    : isActive
                                        ? "bg-secondary text-secondary-foreground"
                                        : "bg-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                            )}
                            style={isElectron ? { WebkitAppRegion: 'no-drag' } as React.CSSProperties : undefined}
                            onClick={() => handleTabClick(win.id, win.path)}
                        >
                            <span className={cn(
                                "shrink-0 transition-colors uppercase", 
                                isSpecialGreen ? "text-white" : isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                            )}>
                                {win.icon || <FileText className="w-4 h-4" />}
                            </span>
                            <span className={cn(
                                "text-[14px] font-light truncate max-w-[150px] transition-colors",
                                isSpecialGreen ? "text-white" : isActive ? "text-foreground" : "text-muted-foreground/80 group-hover:text-foreground"
                            )}>
                                {win.title}
                            </span>
                            {win.isClosable !== false && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleCloseTab(e, win.id);
                                    }}
                                    className={cn(
                                        "p-0.5 rounded-md opacity-0 group-hover:opacity-60 transition-all hover:bg-black/10 hover:text-white hover:opacity-100 ml-1",
                                        isSpecialGreen ? "opacity-60 text-white" : isActive ? "opacity-40" : ""
                                    )}
                                >
                                    <X className="w-[16px] h-[16px]" />
                                </button>
                            )}
                        </div>
                    );
                })}

                {/* More Button */}
                <DropdownMenu>
                    <DropdownMenuTrigger render={
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg shrink-0 text-muted-foreground bg-muted/40 hover:bg-muted/80 border border-border/40 data-[open]:bg-muted/80" style={isElectron ? { WebkitAppRegion: 'no-drag' } as React.CSSProperties : undefined}>
                            <MoreHorizontal className="w-[18px] h-[18px]" />
                        </Button>
                    } />
                    <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={closeAllWindows} className="text-destructive focus:text-destructive cursor-pointer">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Cerrar todas las ventanas
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Right Side Actions */}
            <div 
                className="flex items-center gap-2 ml-4 shrink-0" 
            >
                <TrainingCenterButton />
                <NotificationsMenu />
                <div className="w-[1px] h-4 bg-border/40 mx-1" />
                <ProfileDropdown />
                
                {isElectron && (
                    <>
                        <div className="w-[1px] h-4 bg-border/40 mx-1 shrink-0" />
                        <div className="flex items-center gap-1 shrink-0">
                            <button
                                onClick={() => (window as any).electronAPI.minimize()}
                                className="flex items-center justify-center h-8 w-8 shrink-0 text-white hover:bg-white/10 rounded-md transition-colors cursor-pointer"
                                style={isElectron ? { WebkitAppRegion: 'no-drag' } as React.CSSProperties : undefined}
                                title="Minimizar"
                            >
                                <Minus className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => (window as any).electronAPI.maximize()}
                                className="flex items-center justify-center h-8 w-8 shrink-0 text-white hover:bg-white/10 rounded-md transition-colors cursor-pointer"
                                style={isElectron ? { WebkitAppRegion: 'no-drag' } as React.CSSProperties : undefined}
                                title="Maximizar"
                            >
                                <Square className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => (window as any).electronAPI.close()}
                                className="flex items-center justify-center h-8 w-8 shrink-0 text-white hover:bg-red-600 transition-colors rounded-md cursor-pointer"
                                style={isElectron ? { WebkitAppRegion: 'no-drag' } as React.CSSProperties : undefined}
                                title="Cerrar"
                            >
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
