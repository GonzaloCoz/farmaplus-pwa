import { useLocation, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Magnifer as Search, CloseCircle as X, MenuDots as MoreHorizontal, Widget as LayoutDashboard, Database, ClipboardList, Widget as Package, Document as FileText, Chart as BarChart2, ShieldCheck, Widget as Microscope, TrashBinMinimalistic as Trash2 } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Logo from "@/assets/logo.svg";
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
        <div className="flex items-center w-full h-full gap-2 px-2 lg:px-4 overflow-hidden bg-transparent">
            {/* Logo */}
            <div className="flex items-center justify-center h-10 w-10 shrink-0 bg-muted/50 border border-border/40 rounded-xl">
                <img src={Logo} alt="Logo" className="h-[20px] w-auto opacity-100" />
            </div>

            {/* Search Button */}
            <Button
                variant="ghost"
                className="h-10 gap-2 px-4 rounded-xl bg-background hover:bg-muted/80 text-muted-foreground hover:text-foreground shrink-0 border border-input shadow-sm shadow-black/5 dark:shadow-white/5 transition-all font-medium"
                onClick={onSearchClick}
            >
                <Search className="w-[18px] h-[18px]" />
                <span className="text-[15px]">Buscar</span>
            </Button>

            {/* Create Job Button */}
            <Button
                variant="ghost"
                className="h-10 gap-2 px-4 rounded-xl bg-background hover:bg-muted/80 text-muted-foreground hover:text-foreground shrink-0 border border-input shadow-sm shadow-black/5 dark:shadow-white/5 transition-all font-medium"
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
                    const isSpecialGreen = win.path === '/inventory-reminder';
                    
                    return (
                        <div
                            key={win.id}
                            className={cn(
                                "group relative flex items-center h-10 px-4 gap-3 rounded-xl border transition-all cursor-pointer shrink-0 select-none",
                                isSpecialGreen 
                                    ? "bg-[#0e5e4d] border-[#0e5e4d] text-white shadow-sm hover:bg-[#0c5041] hover:border-[#0c5041]"
                                    : isActive
                                        ? "bg-background dark:bg-white/10 border-border/5 shadow-sm text-foreground dark:text-white ring-1 ring-black/[0.02] animate-in fade-in zoom-in-95 duration-200 backdrop-blur-md"
                                        : "bg-[var(--layout-content)] border-border/5 shadow-sm text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
                            )}
                            onClick={() => handleTabClick(win.id, win.path)}
                        >
                            <span className={cn(
                                "shrink-0 transition-colors uppercase", 
                                isSpecialGreen ? "text-white" : isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                            )}>
                                {win.icon || <FileText className="w-4 h-4" />}
                            </span>
                            <span className={cn(
                                "text-[14px] font-semibold truncate max-w-[150px] transition-colors",
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
                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl shrink-0 text-muted-foreground bg-muted/40 hover:bg-muted/80 border border-border/40 data-[open]:bg-muted/80">
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
            <div className="flex items-center gap-2 ml-4 shrink-0">
                <TrainingCenterButton />
                <NotificationsMenu />
                <div className="w-[1px] h-4 bg-border/40 mx-1" />
                <ProfileDropdown />
            </div>
        </div>
    );
}
