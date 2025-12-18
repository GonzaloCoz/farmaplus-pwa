
import { useState, useEffect } from "react";
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, addMonths, subMonths, setMonth, setYear } from "date-fns";
import { es } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, FileSpreadsheet, FileText, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ExportOptions {
    format: 'pdf' | 'excel';
    rangeType: 'day' | 'month' | 'year';
    dateRange: { from: Date; to: Date };
    selectedStatuses: string[];
}

interface ExportOptionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (options: ExportOptions) => void;
}

const STATUS_OPTIONS = [
    { value: 'active', label: 'Pendientes (Activos)' },
    { value: 'sold', label: 'Vendido / Promo' },
    { value: 'transfer', label: 'Inter-Sucursal' },
    { value: 'return', label: 'Devolución' },
    { value: 'destroyed', label: 'Destrucción' }
];

export function ExportOptionsModal({ isOpen, onClose, onConfirm }: ExportOptionsModalProps) {
    const [formatType, setFormatType] = useState<'pdf' | 'excel'>('pdf');
    const [activeTab, setActiveTab] = useState<'day' | 'month' | 'year'>('day');

    // Date States
    const [dayDate, setDayDate] = useState<Date>(new Date());
    const [endDate, setEndDate] = useState<Date | undefined>(undefined); // Optional logic for "range" in day tab if needed, but user said "start date" and "due date" (end date) logic.
    // Actually user said: "el primero seria para cuando ponga un dia... y en caso de que yo quiera sacar mas de un dia... se eliga en el otro calendario".
    // So "Start Date" is required, "End Date" is optional to define a range.

    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

    // Status State
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['all']);

    useEffect(() => {
        if (isOpen) {
            setFormatType('pdf');
            setActiveTab('day');
            setDayDate(new Date());
            setEndDate(undefined);
            setSelectedMonth(new Date().getMonth().toString());
            setSelectedYear(new Date().getFullYear().toString());
            setSelectedStatuses(['all']);
        }
    }, [isOpen]);

    const toggleStatus = (value: string) => {
        if (value === 'all') {
            setSelectedStatuses(['all']);
            return;
        }

        let newStatuses = selectedStatuses.filter(s => s !== 'all');
        if (selectedStatuses.includes(value)) {
            newStatuses = newStatuses.filter(s => s !== value);
        } else {
            newStatuses.push(value);
        }

        if (newStatuses.length === 0) {
            setSelectedStatuses(['all']);
        } else {
            setSelectedStatuses(newStatuses);
        }
    };

    const handleConfirm = () => {
        let from: Date, to: Date;

        if (activeTab === 'day') {
            from = startOfDay(dayDate);
            to = endDate ? endOfDay(endDate) : endOfDay(dayDate);
        } else if (activeTab === 'month') {
            const date = new Date(parseInt(selectedYear), parseInt(selectedMonth), 1);
            from = startOfMonth(date);
            to = endOfMonth(date);
        } else {
            const date = new Date(parseInt(selectedYear), 0, 1);
            from = startOfYear(date);
            to = endOfYear(date);
        }

        onConfirm({
            format: formatType,
            rangeType: activeTab,
            dateRange: { from, to },
            selectedStatuses
        });
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden gap-0">
                <DialogHeader className="px-6 pt-6 pb-4">
                    <DialogTitle>Exportar Reporte</DialogTitle>
                    <DialogDescription>
                        Configura el rango de fechas y filtros.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 py-2 space-y-6">
                    {/* Format Selection (Mini) */}
                    <div className="flex gap-4">
                        <div
                            className={`flex flex-1 items-center justify-center p-3 rounded-lg border cursor-pointer transition-all gap-2 ${formatType === 'pdf' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:bg-muted/50'}`}
                            onClick={() => setFormatType('pdf')}
                        >
                            <FileText className="w-4 h-4" />
                            <span className="text-sm font-medium">PDF</span>
                        </div>
                        <div
                            className={`flex flex-1 items-center justify-center p-3 rounded-lg border cursor-pointer transition-all gap-2 ${formatType === 'excel' ? 'border-green-600 bg-green-50 text-green-700' : 'border-border text-muted-foreground hover:bg-muted/50'}`}
                            onClick={() => setFormatType('excel')}
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span className="text-sm font-medium">Excel</span>
                        </div>
                    </div>

                    {/* Range Tabs */}
                    <div className="space-y-3">
                        <Label className="text-sm font-medium">Rango de Tiempo</Label>
                        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
                            <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1">
                                <TabsTrigger value="day">Día</TabsTrigger>
                                <TabsTrigger value="month">Mes</TabsTrigger>
                                <TabsTrigger value="year">Año</TabsTrigger>
                            </TabsList>

                            <div className="mt-4 min-h-[80px]">
                                <TabsContent value="day" className="space-y-4 m-0">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground">Fecha Inicio</Label>
                                            <DatePicker date={dayDate} setDate={(d) => d && setDayDate(d)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground">Fecha Fin (Opcional)</Label>
                                            <DatePicker date={endDate} setDate={setEndDate} placeholder="Solo un día" />
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="month" className="space-y-4 m-0">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground">Mes</Label>
                                            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Array.from({ length: 12 }).map((_, i) => (
                                                        <SelectItem key={i} value={i.toString()}>
                                                            {format(new Date(2024, i, 1), 'MMMM', { locale: es })}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground">Año</Label>
                                            <Select value={selectedYear} onValueChange={setSelectedYear}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Array.from({ length: 5 }).map((_, i) => {
                                                        const y = new Date().getFullYear() - i;
                                                        return <SelectItem key={y} value={y.toString()}>{y}</SelectItem>;
                                                    })}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="year" className="space-y-4 m-0">
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Seleccionar Año</Label>
                                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Array.from({ length: 5 }).map((_, i) => {
                                                    const y = new Date().getFullYear() - i;
                                                    return <SelectItem key={y} value={y.toString()}>{y}</SelectItem>;
                                                })}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </TabsContent>
                            </div>
                        </Tabs>
                    </div>

                    {/* Status Categories */}
                    <div className="space-y-3">
                        <Label className="text-sm font-medium">Categorías (Estado)</Label>
                        <div className="flex flex-wrap gap-2">
                            <Badge
                                variant={selectedStatuses.includes('all') ? "default" : "outline"}
                                className={`cursor-pointer ${selectedStatuses.includes('all') ? 'bg-primary hover:bg-primary/90' : 'hover:bg-muted'}`}
                                onClick={() => toggleStatus('all')}
                            >
                                Todos
                            </Badge>
                            {STATUS_OPTIONS.map(status => (
                                <Badge
                                    key={status.value}
                                    variant={selectedStatuses.includes(status.value) ? "default" : "outline"}
                                    className={`cursor-pointer ${selectedStatuses.includes(status.value) ? 'bg-primary hover:bg-primary/90' : 'hover:bg-muted'}`}
                                    onClick={() => toggleStatus(status.value)}
                                >
                                    {status.label}
                                </Badge>
                            ))}
                        </div>
                    </div>
                </div>

                <DialogFooter className="px-6 py-4 bg-muted/20 border-t mt-4 gap-2 sm:gap-0">
                    <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancelar</Button>
                    <Button onClick={handleConfirm} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
                        Generar Reporte
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function DatePicker({ date, setDate, placeholder = "Seleccionar fecha" }: { date?: Date, setDate: (d?: Date) => void, placeholder?: string }) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                        "w-full justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP", { locale: es }) : <span>{placeholder}</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                />
            </PopoverContent>
        </Popover>
    );
}
