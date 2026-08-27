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
    const isElectron = typeof window !== "undefined" && !!(window as any).electronAPI;
    const noDrag = isElectron ? ({ WebkitAppRegion: "no-drag" } as React.CSSProperties) : undefined;

    return (
        <div className="flex items-center w-full h-full gap-1.5 px-2">

            {/* Back / Forward */}
            <Button variant="ghost" size="icon" title="Atrás" style={noDrag} onClick={() => window.history.back()} className={surfaceClasses(3)}>
                <ArrowLeft />
            </Button>
            <Button variant="ghost" size="icon" title="Adelante" style={noDrag} onClick={() => window.history.forward()} className={surfaceClasses(3)}>
                <ArrowRight />
            </Button>

            {/* Search */}
            <Button variant="ghost" size="lg" leadingIcon={Search} style={noDrag} onClick={onSearchClick} className={surfaceClasses(3)}>
                Buscar
            </Button>

            {/* Nueva ventana */}
            <Button variant="ghost" size="lg" leadingIcon={Plus} style={noDrag} onClick={() => openWindow("/", undefined, undefined, true)} className={surfaceClasses(3)}>
                Nueva
            </Button>

            {/* Divider */}
            <div className="w-px h-5 bg-border/40 shrink-0 mx-1" />

            {/* Window tabs */}
            <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto no-scrollbar py-2 -my-2 px-1 -mx-1">
                {windows.map((win) => {
                    const isActive = win.id === activeWindowId;
                    const isSpecialGreen = win.path === "/recordatorio-inventario";
                    const { icon: tabIcon } = getTabMetaForPath(win.path);
                    const Icon = tabIcon ?? <FileText size={16} />;

                    const buttonContent = (
                        <Button
                            key={win.id}
                            variant={isActive ? "ghost" : "ghost"}
                            size="lg"
                            style={noDrag}
                            onClick={() => { setActiveWindow(win.id); navigate(win.path); }}
                            className={cn(
                                "group cursor-pointer shrink-0 max-w-[200px]",
                                isSpecialGreen && "bg-[#0e5e4d] text-white hover:bg-[#0c5041]",
                                isActive && surfaceClasses(3)
                            )}
                            trailingIcon={win.isClosable !== false ? function CloseTabIcon() {
                                return (
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        aria-label={`Cerrar ${win.title}`}
                                        className="cursor-pointer opacity-0 group-hover:opacity-50 hover:!opacity-100 hover:!text-red-500 transition-all inline-flex items-center justify-center shrink-0 ml-1.5 w-[11px] h-[11px] p-0"
                                        onClick={(e) => { e.stopPropagation(); closeWindow(win.id); }}
                                        onKeyDown={(e) => e.key === "Enter" && closeWindow(win.id)}
                                    >
                                        <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M17 7L7 17M7 7L17 17" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    </span>
                                );
                            } : undefined}
                        >
                            {Icon}
                            <span className="truncate block py-1 -my-1">{win.title}</span>
                        </Button>
                    );

                    return buttonContent;
                })}

                {/* More Options */}
                <DropdownMenu>
                    <DropdownTrigger render={
                        <Button variant="ghost" size="icon" style={noDrag} className={cn("shrink-0 cursor-pointer", surfaceClasses(3))}>
                            <DotsHorizontal />
                        </Button>
                    } />
                    <DropdownContent align="end">
                        <MenuItem
                            index={0}
                            icon={Trash}
                            label="Cerrar todas las ventanas"
                            onSelect={closeAllWindows}
                            className="text-destructive focus:text-destructive"
                        />
                    </DropdownContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
