import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BRANCH_NAMES } from "@/config/users";
import { calendarService, CalendarEvent } from "@/services/calendarService";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface AddEventDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onEventAdded: (event: CalendarEvent) => void;
}

export function AddEventDialog({ open, onOpenChange, onEventAdded }: AddEventDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [title, setTitle] = useState("");
    const [branch, setBranch] = useState("");
    const [sector, setSector] = useState("Farmacia");
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!branch || !date) {
            toast.error("Sucursal y fecha son requeridas");
            return;
        }

        setIsLoading(true);
        try {
            const newEvent = await calendarService.addEvent({
                title: title || `Inventario ${branch}`,
                branch_name: branch,
                sector,
                date
            });

            if (newEvent) {
                toast.success("Evento agregado correctamente");
                onEventAdded(newEvent);
                onOpenChange(false);
                // Reset form
                setTitle("");
                setBranch("");
                setSector("Farmacia");
            } else {
                toast.error("Error al crear el evento");
            }
        } catch (error) {
            console.error(error);
            toast.error("Error inesperado");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Programar Inventario</DialogTitle>
                    <div className="text-sm text-muted-foreground">
                        Complete los datos del nuevo evento de inventario.
                    </div>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="branch">Sucursal</Label>
                        <Select value={branch} onValueChange={setBranch}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar sucursal" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px]">
                                {BRANCH_NAMES.map((b) => (
                                    <SelectItem key={b} value={b}>{b}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="sector">Sector</Label>
                        <Select value={sector} onValueChange={setSector}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar sector" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Farmacia">Farmacia</SelectItem>
                                <SelectItem value="Perfumería">Perfumería</SelectItem>
                                <SelectItem value="General">General</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="date">Fecha</Label>
                        <Input
                            id="date"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="title">Título (Opcional)</Label>
                        <Input
                            id="title"
                            placeholder="Ej. Inventario Anual"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar Evento
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
