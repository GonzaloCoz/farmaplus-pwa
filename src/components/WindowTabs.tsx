import { useLocation, useNavigate } from "react-router-dom";
import { Search, Plus, X, MoreHorizontal, LayoutDashboard, Database, ClipboardList, Package, FileText, Settings, User, BarChart2, ShieldCheck, Microscope, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Logo from "@/assets/logo.svg";
import { useWindowManager } from "@/contexts/WindowManagerContext";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationsMenu } from "@/components/HeaderMenus";


export function WindowTabs({ onSearchClick }: { onSearchClick: () => void }) {
    const location = useLocation();
    const navigate = useNavigate();
    const { windows, activeWindowId, openWindow, closeWindow, setActiveWindow, closeAllWindows } = useWindowManager();

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
        <div className="flex items-center w-full h-full gap-2 px-4 xl:px-8 lg:px-6 overflow-hidden bg-transparent">
            {/* Logo */}
            <div className="flex items-center justify-center h-11 w-11 shrink-0 bg-muted/50 border border-border/40 rounded-xl">
                <img src={Logo} alt="Logo" className="h-[24px] w-auto opacity-100" />
            </div>

            {/* Search Button */}
            <Button
                variant="ghost"
                className="h-11 gap-3 px-5 rounded-xl bg-[#f0eeef] dark:bg-[#2a2a2a] hover:bg-muted/80 text-gray-700 dark:text-gray-200 hover:text-black dark:hover:text-white shrink-0 border border-border/40 transition-all font-medium"
                onClick={onSearchClick}
            >
                <Search className="w-[18px] h-[18px]" />
                <span className="text-[15px]">Buscar</span>
            </Button>

            {/* Create Job Button */}
            <Button
                variant="ghost"
                className="h-11 gap-2 px-5 rounded-xl bg-[#f0eeef] dark:bg-[#2a2a2a] hover:bg-muted/80 text-gray-700 dark:text-gray-200 hover:text-black dark:hover:text-white shrink-0 border border-border/40 transition-all font-medium"
                onClick={handleCreateJob}
            >
                <Plus className="w-[18px] h-[18px]" />
                <span className="text-[15px] whitespace-nowrap">Nueva</span>
            </Button>

            {/* Separator */}
            <div className="w-[1px] h-6 bg-border/40 mx-2 shrink-0" />

            {/* Tabs List */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 mask-linear-fade flex-1">
                {windows.map((win) => {
                    const isActive = activeWindowId === win.id;
                    return (
                        <div
                            key={win.id}
                            className={cn(
                                "group relative flex items-center h-11 px-5 gap-3 rounded-xl border transition-all cursor-pointer shrink-0 select-none",
                                isActive
                                    ? "bg-white dark:bg-[#1e1e1e] border-border/60 shadow-md text-black dark:text-white ring-1 ring-black/[0.01] dark:ring-white/[0.03] elevation-3 animate-in fade-in zoom-in-95 duration-200"
                                    : "bg-[#f0eeef] dark:bg-[#2a2a2a] border-transparent text-gray-500 dark:text-zinc-400 hover:bg-muted/80 hover:text-black dark:hover:text-white transition-colors"
                            )}
                            onClick={() => handleTabClick(win.id, win.path)}
                        >
                            <span className={cn("shrink-0 transition-colors", isActive ? "text-primary" : "text-gray-500 dark:text-zinc-400 group-hover:text-black dark:group-hover:text-white")}>
                                {win.icon || <FileText className="w-4 h-4" />}
                            </span>
                            <span className={cn(
                                "text-[15px] font-semibold truncate max-w-[160px] transition-colors",
                                isActive ? "text-black dark:text-white" : "text-gray-600 dark:text-zinc-400 group-hover:text-black dark:group-hover:text-white"
                            )}>
                                {win.title}
                            </span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleCloseTab(e, win.id);
                                }}
                                className={cn(
                                    "p-0.5 rounded-md opacity-0 group-hover:opacity-60 transition-all hover:bg-muted hover:text-destructive hover:opacity-100 ml-1",
                                    isActive ? "opacity-40" : "" // Show faint close on active
                                )}
                            >
                                <X className="w-[16px] h-[16px]" />
                            </button>
                        </div>
                    );
                })}

                {/* More Button */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl shrink-0 text-muted-foreground bg-[#f0eeef] dark:bg-[#2a2a2a] hover:bg-muted/80 border border-border/40 data-[state=open]:bg-muted/80">
                            <MoreHorizontal className="w-[18px] h-[18px]" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={closeAllWindows} className="text-destructive focus:text-destructive cursor-pointer">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Cerrar todas las ventanas
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-2 ml-4 shrink-0">
                <NotificationsMenu />
                <button
                    onClick={() => navigate('/settings')}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50 border border-border/40 hover:bg-muted/80 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                    <Settings className="w-4 h-4 text-muted-foreground" />
                </button>
                <div className="w-[1px] h-4 bg-border/40 mx-1" />
                <button
                    onClick={() => navigate('/profile')}
                    className="group flex items-center justify-center h-10 w-10 rounded-xl overflow-hidden hover:ring-2 hover:ring-primary/20 transition-all bg-muted/50 border border-border/40"
                >
                    <div className="h-full w-full flex items-center justify-center text-[11px] font-bold text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                        GC
                    </div>
                </button>
            </div>
        </div>
    );
}
