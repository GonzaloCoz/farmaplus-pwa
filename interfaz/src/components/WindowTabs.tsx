import React from "react";
import { useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    ArrowRight,
    SearchLg as Search,
    Plus,
    XClose,
    DotsHorizontal,
    File02 as FileText,
    Trash01 as Trash,
} from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownTrigger,
    DropdownContent,
    MenuItem,
} from "@/components/ui/dropdown";
import { useWindowManager } from "@/contexts/WindowManagerContext";
import { cn } from "@/lib/utils";
import { surfaceClasses } from "@/lib/surface-classes";
import { getTabMetaForPath } from "@/config/tabConfig";

interface WindowTabsProps {
    onSearchClick: () => void;
}

export function WindowTabs({ onSearchClick }: WindowTabsProps) {
    const navigate = useNavigate();
    const { windows, activeWindowId, openWindow, closeWindow, setActiveWindow, closeAllWindows } = useWindowManager();

    return (
        <div className="flex items-center w-full h-full gap-1.5 px-2" data-tauri-drag-region>

            {/* Back / Forward Group */}
            <div className="flex items-center gap-1 shrink-0">
                <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Atrás"
                    onClick={() => navigate(-1)}
                    className={cn("h-[34px] w-[34px] rounded-lg shrink-0", surfaceClasses(3))}
                >
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Adelante"
                    onClick={() => navigate(1)}
                    className={cn("h-[34px] w-[34px] rounded-lg shrink-0", surfaceClasses(3))}
                >
                    <ArrowRight className="w-4 h-4" />
                </Button>
            </div>

            {/* Action Group: Buscar & Nueva */}
            <div className="flex items-center gap-1.5 shrink-0 ml-0.5">
                <Button
                    variant="ghost"
                    size="sm"
                    leadingIcon={Search}
                    onClick={onSearchClick}
                    className={cn("h-[34px] ps-2.5 pe-3 rounded-lg text-xs font-medium gap-1.5 shrink-0", surfaceClasses(3))}
                >
                    Buscar
                </Button>

                <Button
                    variant="ghost"
                    size="sm"
                    leadingIcon={Plus}
                    onClick={() => openWindow("/", undefined, undefined, true)}
                    className={cn("h-[34px] ps-2.5 pe-3 rounded-lg text-xs font-medium gap-1.5 shrink-0", surfaceClasses(3))}
                >
                    Nueva
                </Button>
            </div>

            {/* Divider */}
            <div className="w-px h-4.5 bg-border/40 shrink-0 mx-1" />

            {/* Window tabs */}
            <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto no-scrollbar py-2 -my-2 px-1 -mx-1" data-tauri-drag-region>
                {windows.map((win) => {
                    const isActive = win.id === activeWindowId;
                    const { icon: tabIcon } = getTabMetaForPath(win.path);
                    const Icon = win.icon ?? tabIcon ?? <FileText className="w-4 h-4" />;

                    return (
                        <Button
                            key={win.id}
                            variant="ghost"
                            size="sm"
                            onClick={() => setActiveWindow(win.id)}
                            className={cn(
                                "group cursor-pointer shrink-0 max-w-[210px] h-[34px] ps-2.5 pe-2 rounded-lg text-xs font-medium gap-1.5",
                                isActive && surfaceClasses(3)
                            )}
                            trailingIcon={win.isClosable !== false ? function CloseTabIcon() {
                                return (
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        aria-label={`Cerrar ${win.title}`}
                                        className="cursor-pointer opacity-0 group-hover:opacity-80 hover:!opacity-100 hover:text-red-500 transition-all inline-flex items-center justify-center shrink-0 ml-1 w-3.5 h-3.5 p-0 rounded-sm hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground"
                                        onClick={(e) => { e.stopPropagation(); closeWindow(win.id); }}
                                        onKeyDown={(e) => e.key === "Enter" && closeWindow(win.id)}
                                    >
                                        <XClose className="w-3.5 h-3.5 stroke-[2.2]" />
                                    </span>
                                );
                            } : undefined}
                        >
                            {Icon}
                            <span className="truncate">{win.title}</span>
                        </Button>
                    );
                })}

                {/* More Options - only visible when multiple tabs are open */}
                {windows.length > 1 && (
                    <DropdownMenu>
                        <DropdownTrigger render={
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                className={cn("h-[34px] w-[34px] rounded-lg shrink-0 cursor-pointer", surfaceClasses(3))}
                            >
                                <DotsHorizontal className="w-4 h-4" />
                            </Button>
                        } />
                        <DropdownContent align="end">
                            <MenuItem
                                index={0}
                                icon={Trash}
                                label="Cerrar todas las pestañas"
                                onSelect={closeAllWindows}
                                className="text-destructive focus:text-destructive"
                            />
                        </DropdownContent>
                    </DropdownMenu>
                )}
            </div>
        </div>
    );
}
