import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notify } from "@/lib/notifications";
import { Search, Check } from "lucide-react";

const BRANCHES = [
  "Belgrano VI", "Barracas", "Recoleta", "Belgrano", "Belgrano II", "Belgrano III",
  "Belgrano IV", "Belgrano V", "Belgrano VII", "Belgrano VIII", "Berazategui",
  "Berazategui II", "Caballito", "Caballito II", "Caballito III", "Caballito IV",
  "Chacarita", "Devoto", "Devoto II", "Flores", "Gonzalez Catan", "Gonzalez Catan II",
  "Gonzalez Catan III", "Las Cañitas", "Mercedes", "Microcentro", "Microcentro II",
  "Morón", "Nuñez", "Padua", "Palermo", "Palermo II", "Palermo III", "Parque Centenario",
  "Parque Patricios", "Pilar", "Pompeya", "Quilmes", "Ramos Mejia", "Ramos Mejia II",
  "Ramos Mejia III", "Recoleta II", "Recoleta III", "Recoleta IV", "Recoleta V",
  "Retiro", "Retiro II", "Saladillo", "San Isidro", "San Isidro II", "San Miguel",
  "Tribunales", "Villa Ballester", "Villa Ballester II", "Villa Crespo",
  "Villa del Parque", "Villa del Parque II", "Villa Luro", "Villa Urquiza",
  "Villa Urquiza II", "Villa Urquiza III",
];

interface SaveReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { name: string; branch: string; sector: string; date: string }) => void;
}

export function SaveReportModal({ open, onOpenChange, onSave }: SaveReportModalProps) {
  const [name, setName] = useState("");
  const [branch, setBranch] = useState("");
  const [branchSearch, setBranchSearch] = useState("");
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [sector, setSector] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);

  const filteredBranches = useMemo(() => {
    return BRANCHES.filter(b => b.toLowerCase().includes(branchSearch.toLowerCase()));
  }, [branchSearch]);

  const handleSave = () => {
    if (!name.trim()) {
      notify.error("Datos incompletos", "Por favor, ingresa un nombre para el reporte");
      return;
    }
    if (!branch) {
      notify.error("Datos incompletos", "Por favor, selecciona una sucursal");
      return;
    }
    if (!sector.trim()) {
      notify.error("Datos incompletos", "Por favor, ingresa el sector");
      return;
    }
    if (!date) {
      notify.error("Datos incompletos", "Por favor, selecciona una fecha");
      return;
    }

    setSaving(true);
    try {
      onSave({ name, branch, sector, date });
      notify.success("Reporte guardado", "El reporte se guardó correctamente");
      setName("");
      setBranch("");
      setBranchSearch("");
      setSector("");
      setDate(new Date().toISOString().split("T")[0]);
      onOpenChange(false);
    } catch (error) {
      notify.error("Error al guardar", "No se pudo guardar el reporte");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[480px] p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Guardar Reporte</DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-4">
          <div>
            <Label htmlFor="report-name" className="text-sm font-medium">
              Nombre del Reporte *
            </Label>
            <Input
              id="report-name"
              placeholder="Ej: Auditoria - Nov 2025"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2"
            />
          </div>

          <div className="relative">
            <Label htmlFor="report-branch" className="text-sm font-medium">
              Sucursal *
            </Label>
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="report-branch"
                placeholder="Buscar sucursal..."
                value={branchSearch}
                onChange={(e) => {
                  setBranchSearch(e.target.value);
                  setShowBranchDropdown(true);
                }}
                onFocus={() => setShowBranchDropdown(true)}
                className="pl-8"
              />
            </div>
            {showBranchDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-lg z-50 max-h-48 overflow-auto">
                {filteredBranches.length > 0 ? (
                  filteredBranches.map((b) => (
                    <button
                      key={b}
                      className="w-full text-left px-3 py-2 hover:bg-accent flex items-center justify-between"
                      onClick={() => {
                        setBranch(b);
                        setBranchSearch("");
                        setShowBranchDropdown(false);
                      }}
                    >
                      {b}
                      {branch === b && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    No se encontraron sucursales
                  </div>
                )}
              </div>
            )}
            {branch && (
              <div className="mt-2 px-3 py-2 bg-accent rounded-md text-sm">
                Seleccionada: <span className="font-medium">{branch}</span>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="report-sector" className="text-sm font-medium">
              Sector *
            </Label>
            <Input
              id="report-sector"
              placeholder="Ej: Farmacia, Perfumería, General"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="report-date" className="text-sm font-medium">
              Fecha del Inventario *
            </Label>
            <Input
              id="report-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-2"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1"
            >
              {saving ? "Guardando..." : "Guardar Reporte"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
