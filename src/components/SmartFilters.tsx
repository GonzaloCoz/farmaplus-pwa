import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
    Filter,
    Calendar as CalendarIcon,
    Tag,
    ChevronLeft,
    Check,
    X
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export interface FilterState {
    status: string[]; // Array of selected statuses
    date: Date | undefined; // Selected date
}

interface SmartFiltersProps {
    onFilterChange: (filters: FilterState) => void;
    activeFilters: FilterState;
}

type FilterView = 'grid' | 'status' | 'date';

export function SmartFilters({ onFilterChange, activeFilters }: SmartFiltersProps) {
    const [open, setOpen] = useState(false);
    const [view, setView] = useState<FilterView>('grid');

    const statuses = [
        { value: 'active', label: 'Activo', color: 'bg-green-500' },
        { value: 'sold', label: 'Vendido', color: 'bg-blue-500' },
        { value: 'transfer', label: 'Transferido', color: 'bg-purple-500' },
        { value: 'return', label: 'Devolución', color: 'bg-orange-500' },
        { value: 'destroyed', label: 'Destruido', color: 'bg-red-500' },
    ];

    const hasActiveFilters = activeFilters.status.length > 0 || activeFilters.date !== undefined;

    const handleStatusToggle = (statusValue: string) => {
        const currentStatuses = activeFilters.status;
        let newStatuses: string[];

        if (currentStatuses.includes(statusValue)) {
            newStatuses = currentStatuses.filter(s => s !== statusValue);
        } else {
            newStatuses = [...currentStatuses, statusValue];
        }

        onFilterChange({ ...activeFilters, status: newStatuses });
    };

    const handleDateSelect = (date: Date | undefined) => {
        onFilterChange({ ...activeFilters, date });
        // Don't close immediately to allow deselecting or changing
    };

    const clearFilters = () => {
        onFilterChange({ status: [], date: undefined });
        setOpen(false);
        setView('grid');
    };

    const StatusView = () => (
        <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
                <Button variant="ghost" size="sm" onClick={() => setView('grid')} className="h-8 px-2 -ml-2">
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Volver
                </Button>
                <span className="text-sm font-medium">Estado</span>
            </div>
            <div className="grid gap-1">
                {statuses.map((status) => {
                    const isSelected = activeFilters.status.includes(status.value);
                    return (
                        <div
                            key={status.value}
                            className={cn(
                                "flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors text-sm",
                                isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                            )}
                            onClick={() => handleStatusToggle(status.value)}
                        >
                            <div className="flex items-center gap-2">
                                <div className={cn("w-2 h-2 rounded-full", status.color)} />
                                <span>{status.label}</span>
                            </div>
                            {isSelected && <Check className="w-4 h-4" />}
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const DateView = () => (
        <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
                <Button variant="ghost" size="sm" onClick={() => setView('grid')} className="h-8 px-2 -ml-2">
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Volver
                </Button>
                <span className="text-sm font-medium">Fecha</span>
            </div>
            <Calendar
                mode="single"
                selected={activeFilters.date}
                onSelect={handleDateSelect}
                className="rounded-md border shadow-sm"
                locale={es}
            />
        </div>
    );

    const GridView = () => (
        <div className="grid grid-cols-2 gap-2 p-1">
            <Button
                variant="outline"
                className="h-24 flex flex-col items-center justify-center gap-2 hover:bg-primary/5 hover:border-primary/50 transition-all border-dashed"
                onClick={() => setView('date')}
            >
                <CalendarIcon className="w-8 h-8 text-muted-foreground" />
                <span className="text-xs font-medium">Fecha</span>
                {activeFilters.date && (
                    <Badge variant="secondary" className="text-[10px] h-5 px-1">
                        1 activo
                    </Badge>
                )}
            </Button>
            <Button
                variant="outline"
                className="h-24 flex flex-col items-center justify-center gap-2 hover:bg-primary/5 hover:border-primary/50 transition-all border-dashed"
                onClick={() => setView('status')}
            >
                <Tag className="w-8 h-8 text-muted-foreground" />
                <span className="text-xs font-medium">Estado</span>
                {activeFilters.status.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-5 px-1">
                        {activeFilters.status.length} activos
                    </Badge>
                )}
            </Button>
        </div>
    );

    return (
        <div className="flex items-center gap-2">
            <Popover open={open} onOpenChange={(isOpen) => {
                setOpen(isOpen);
                if (!isOpen) setView('grid'); // Reset view on close
            }}>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 border-dashed">
                        <Filter className="w-4 h-4 mr-2" />
                        Filtros
                        {hasActiveFilters && (
                            <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px]">
                                {(activeFilters.status.length) + (activeFilters.date ? 1 : 0)}
                            </Badge>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-4" align="start">
                    {/* Header with Clear Option */}
                    {hasActiveFilters && view === 'grid' && (
                        <div className="mb-2 flex justify-end">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearFilters}
                                className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive"
                            >
                                Limpiar todo
                                <X className="w-3 h-3 ml-1" />
                            </Button>
                        </div>
                    )}

                    {view === 'grid' && <GridView />}
                    {view === 'status' && <StatusView />}
                    {view === 'date' && <DateView />}
                </PopoverContent>
            </Popover>

            {/* In-line Chips for Active Filters (optional, user asked for design like reference which hides them in dropdown usually, but inline chips are good UX) */}
            {/* Let's stick to the dropdown design first as requested */}
        </div>
    );
}
