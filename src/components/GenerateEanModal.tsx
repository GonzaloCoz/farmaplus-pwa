import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface GenerateEanModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GenerateEanModal({ isOpen, onOpenChange }: GenerateEanModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Generar Código EAN</DialogTitle>
          <DialogDescription>
            Introduce los detalles del producto para generar un nuevo código EAN.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="product-name" className="text-right">
              Producto
            </Label>
            <Input id="product-name" placeholder="Ej: Paracetamol 500mg" className="col-span-3" />
          </div>
          {/* Añade más campos aquí según tu lógica */}
        </div>
        <DialogFooter>
          <Button type="submit">Generar EAN</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}