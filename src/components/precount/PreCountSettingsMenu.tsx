import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    Drawer,
    DrawerContent,
    DrawerTrigger,
    DrawerClose,
} from '@/components/ui/drawer';
import {
    DropdownMenu,
    DropdownTrigger,
    DropdownContent,
    DropdownLabel,
    DropdownSeparator,
    MenuItem,
} from "@/components/ui/dropdown";
import { Switch } from '@/components/ui/switch';
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTheme } from '@/hooks/useTheme';
import { useUser } from '@/contexts/UserContext';
import {
    Settings01 as Settings,
    Check,
    CheckCircle,
    RefreshCcw01 as RefreshCcw,
    Download01 as Download,
    Minimize01 as Minimize,
    Maximize01 as Maximize,
    LogOut01 as LogOut,
} from '@untitledui/icons';

// --- Coss UI Drawer Components (Local Registry Simulation) ---
export function DrawerPanel({ className, children, ...props }: any) {
    return (
        <DrawerContent className={cn("p-0 rounded-t-[20px] max-h-[90vh]", className)} showBar {...props}>
            <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
                {children}
            </div>
        </DrawerContent>
    );
}

export function DrawerMenu({ className, children, ...props }: any) {
    return <div className={cn("flex flex-col", className)} {...props}>{children}</div>;
}

export function DrawerMenuGroup({ className, children, ...props }: any) {
    return <div className={cn("flex flex-col", className)} {...props}>{children}</div>;
}

export function DrawerMenuGroupLabel({ className, children, ...props }: any) {
    return (
        <div className={cn("px-5 pt-3 pb-1 text-[12px] font-medium text-muted-foreground/40", className)} {...props}>
            {children}
        </div>
    );
}

export function DrawerMenuItem({ className, children, icon, isSelected, variant = "ghost", indent = false, ...props }: any) {
    return (
        <Button
            variant="ghost"
            className={cn(
                "justify-start h-9 px-5 gap-2 font-normal w-full rounded-none hover:bg-accent/30 transition-none",
                isSelected && "text-foreground font-medium",
                variant === "destructive" && "text-destructive hover:text-destructive hover:bg-destructive/5",
                className
            )}
            {...props}
        >
            <div className="flex shrink-0 items-center justify-center size-4">
                {isSelected ? <Check className="size-3.5 stroke-[2.5]" /> : (icon || (indent && <div className="size-4" />))}
            </div>
            <span className="flex-1 text-left text-[14px] truncate">{children}</span>
        </Button>
    );
}

export function DrawerMenuSeparator({ className, ...props }: any) {
    return <div className={cn("h-px bg-border/40 my-2 mx-0", className)} {...props} />;
}

export interface PreCountSettingsMenuProps {
    highSpeedMode: boolean;
    setHighSpeedMode: (val: boolean) => void;
    isManualMode: boolean;
    setIsManualMode: (val: boolean) => void;
    autoSave: boolean;
    setAutoSave: (val: boolean) => void;
    sortOrder: string;
    setSortOrder: (val: string) => void;
    isZenMode: boolean;
    setIsZenMode: (val: boolean) => void;
    handleResetSector: () => void;
    handleExportTXT: () => void;
    handleFinishClick: () => void;
    accessMode: string;
}

export function PreCountSettingsMenu({
    highSpeedMode,
    setHighSpeedMode,
    isManualMode,
    setIsManualMode,
    autoSave,
    setAutoSave,
    sortOrder,
    setSortOrder,
    isZenMode,
    setIsZenMode,
    handleResetSector,
    handleExportTXT,
    handleFinishClick,
    accessMode
}: PreCountSettingsMenuProps) {
    const { theme, toggleTheme } = useTheme();
    const { logout } = useUser();
    const isMobile = useMediaQuery("(max-width: 768px)");

    const trigger = (
        <Button variant="outline" size="icon" className="h-10 w-10 shrink-0">
            <Settings className="size-4" />
        </Button>
    );

    if (isMobile) {
        return (
            <Drawer>
                <DrawerTrigger asChild>
                    {trigger}
                </DrawerTrigger>
                <DrawerPanel className="pb-10">
                    <DrawerMenu>
                        <DrawerMenuGroup>
                            <DrawerMenuGroupLabel>Modo de lectura</DrawerMenuGroupLabel>
                            <DrawerMenuItem
                                isSelected={highSpeedMode && !isManualMode}
                                indent
                                onClick={() => { setHighSpeedMode(true); setIsManualMode(false); }}
                            >
                                Alta velocidad (+1)
                            </DrawerMenuItem>
                            <DrawerMenuItem
                                isSelected={!highSpeedMode && !isManualMode}
                                indent
                                onClick={() => { setHighSpeedMode(false); setIsManualMode(false); }}
                            >
                                Ingreso de cantidad
                            </DrawerMenuItem>
                            {accessMode !== 'salon' && (
                                <DrawerMenuItem
                                    isSelected={isManualMode}
                                    indent
                                    onClick={() => setIsManualMode(!isManualMode)}
                                >
                                    Teclado manual
                                </DrawerMenuItem>
                            )}
                        </DrawerMenuGroup>

                        <DrawerMenuSeparator />

                        <DrawerMenuGroup>
                            <DrawerMenuGroupLabel>Configuración</DrawerMenuGroupLabel>
                            <DrawerMenuItem
                                icon={autoSave ? <CheckCircle className="size-4 text-primary" /> : <div className="size-4 border border-muted-foreground/30 rounded-sm" />}
                                onClick={() => setAutoSave(!autoSave)}
                            >
                                Auto guardado
                            </DrawerMenuItem>
                        </DrawerMenuGroup>

                        <DrawerMenuSeparator />

                        <DrawerMenuGroup>
                            <DrawerMenuGroupLabel>Apariencia</DrawerMenuGroupLabel>
                            <div className="flex items-center justify-between px-5 h-9">
                                <span className="text-[14px]">Modo oscuro</span>
                                <Switch
                                    checked={theme === 'dark'}
                                    onCheckedChange={toggleTheme}
                                    className="[--thumb-size:--spacing(4)] sm:[--thumb-size:--spacing(3)]"
                                />
                            </div>
                        </DrawerMenuGroup>

                        <DrawerMenuSeparator />

                        <DrawerMenuGroup>
                            <DrawerMenuGroupLabel>Filtros de orden</DrawerMenuGroupLabel>
                            <DrawerMenuItem
                                isSelected={sortOrder === 'name_asc'}
                                indent
                                onClick={() => setSortOrder('name_asc')}
                            >
                                Nombre: A a la Z
                            </DrawerMenuItem>
                            <DrawerMenuItem
                                isSelected={sortOrder === 'name_desc'}
                                indent
                                onClick={() => setSortOrder('name_desc')}
                            >
                                Nombre: Z a la A
                            </DrawerMenuItem>
                            <DrawerMenuItem
                                isSelected={sortOrder === 'qty_desc'}
                                indent
                                onClick={() => setSortOrder('qty_desc')}
                            >
                                Cantidad: Mayor a menor
                            </DrawerMenuItem>
                            <DrawerMenuItem
                                isSelected={sortOrder === 'qty_asc'}
                                indent
                                onClick={() => setSortOrder('qty_asc')}
                            >
                                Cantidad: Menor a mayor
                            </DrawerMenuItem>
                        </DrawerMenuGroup>

                        <DrawerMenuSeparator />

                        <DrawerMenuGroup>
                            <DrawerMenuGroupLabel>Acciones</DrawerMenuGroupLabel>
                            <DrawerMenuItem
                                icon={<RefreshCcw className="size-4" />}
                                onClick={handleResetSector}
                            >
                                Reiniciar sector
                            </DrawerMenuItem>
                            <DrawerMenuItem
                                icon={<Download className="size-4" />}
                                onClick={handleExportTXT}
                            >
                                Exportar TXT
                            </DrawerMenuItem>
                            <DrawerMenuItem
                                icon={isZenMode ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
                                onClick={() => setIsZenMode(!isZenMode)}
                            >
                                {isZenMode ? "Salir Modo Zen" : "Modo Zen"}
                            </DrawerMenuItem>
                            <DrawerClose asChild>
                                <DrawerMenuItem
                                    variant="destructive"
                                    icon={<LogOut className="size-4" />}
                                    onClick={handleFinishClick}
                                >
                                    Finalizar sesión
                                </DrawerMenuItem>
                            </DrawerClose>
                        </DrawerMenuGroup>
                    </DrawerMenu>
                </DrawerPanel>
            </Drawer>
        );
    }

    return (
        <DropdownMenu>
            <DropdownTrigger asChild>
                {trigger}
            </DropdownTrigger>
            <DropdownContent align="end" className="w-56">
                <DropdownLabel>Modo de lectura</DropdownLabel>
                <MenuItem
                    index={0}
                    label="Alta velocidad (+1)"
                    checked={highSpeedMode && !isManualMode}
                    onSelect={() => { setHighSpeedMode(true); setIsManualMode(false); }}
                />
                <MenuItem
                    index={1}
                    label="Ingreso de cantidad"
                    checked={!highSpeedMode && !isManualMode}
                    onSelect={() => { setHighSpeedMode(false); setIsManualMode(false); }}
                />
                {accessMode !== 'salon' && (
                    <MenuItem
                        index={2}
                        label="Teclado manual"
                        checked={isManualMode}
                        onSelect={() => setIsManualMode(!isManualMode)}
                    />
                )}

                <DropdownSeparator />
                <DropdownLabel>Configuración</DropdownLabel>
                <MenuItem
                    index={3}
                    label="Auto guardado"
                    checked={autoSave}
                    onSelect={() => setAutoSave(!autoSave)}
                />

                <DropdownSeparator />
                <DropdownLabel>Apariencia</DropdownLabel>
                <div className="flex items-center justify-between px-2.5 py-1.5 text-sm">
                    <span>Modo oscuro</span>
                    <Switch
                        checked={theme === 'dark'}
                        onCheckedChange={toggleTheme}
                        className="[--thumb-size:--spacing(4)] sm:[--thumb-size:--spacing(3)]"
                    />
                </div>

                <DropdownSeparator />
                <DropdownLabel>Filtros de orden</DropdownLabel>
                <MenuItem
                    index={0}
                    label="Nombre: A a la Z"
                    checked={sortOrder === 'name_asc'}
                    onSelect={() => setSortOrder('name_asc')}
                />
                <MenuItem
                    index={1}
                    label="Nombre: Z a la A"
                    checked={sortOrder === 'name_desc'}
                    onSelect={() => setSortOrder('name_desc')}
                />
                <MenuItem
                    index={2}
                    label="Cantidad: Mayor a menor"
                    checked={sortOrder === 'qty_desc'}
                    onSelect={() => setSortOrder('qty_desc')}
                />
                <MenuItem
                    index={3}
                    label="Cantidad: Menor a mayor"
                    checked={sortOrder === 'qty_asc'}
                    onSelect={() => setSortOrder('qty_asc')}
                />

                <DropdownSeparator />
                <DropdownLabel>Acciones</DropdownLabel>
                <MenuItem
                    index={3}
                    icon={RefreshCcw}
                    label="Reiniciar sector"
                    onSelect={handleResetSector}
                />
                <MenuItem
                    index={4}
                    icon={Download}
                    label="Exportar TXT"
                    onSelect={handleExportTXT}
                />
                <MenuItem
                    index={5}
                    icon={isZenMode ? Minimize : Maximize}
                    label={isZenMode ? "Salir Modo Zen" : "Modo Zen"}
                    onSelect={() => setIsZenMode(!isZenMode)}
                />
                <DropdownSeparator />
                <MenuItem
                    index={6}
                    icon={CheckCircle}
                    label="Finalizar sesión"
                    onSelect={handleFinishClick}
                    className="text-destructive focus:text-destructive"
                />
            </DropdownContent>
        </DropdownMenu>
    );
}
