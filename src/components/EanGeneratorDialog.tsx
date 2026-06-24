import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notify } from "@/lib/notifications";
import { useBarcodeHistory } from "@/hooks/use-barcode-history";
import { BarcodeDisplay } from "@/components/BarcodeDisplay";
import { Copy, Printer, Widget as Barcode } from "@solar-icons/react";
import { getProductByEAN } from '@/services/productService';

interface EanGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EanGeneratorDialog({ open, onOpenChange }: EanGeneratorDialogProps) {
  // --- Estados para el generador EAN ---
  const [eanCode, setEanCode] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [foundProductName, setFoundProductName] = useState<string | null>(null);
  const [selectedHistoryCode, setSelectedHistoryCode] = useState<string | null>(null);
  const { history, addToHistory, clearHistory } = useBarcodeHistory();

  const findAndDisplayCode = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed || !/^\d+$/.test(trimmed)) {
      notify.error("Error", "Por favor, ingresa un código numérico válido.");
      return;
    }

    try {
      const foundProduct = await getProductByEAN(trimmed);
      setFoundProductName(foundProduct ? foundProduct.name : null);
    } catch (err) {
      console.error("Error looking up EAN:", err);
      setFoundProductName(null);
    }

    setGeneratedCode(trimmed);
    setSelectedHistoryCode(trimmed);
  };

  const handleGenerateFromInput = () => {
    const trimmed = eanCode.trim();
    if (!trimmed) {
      notify.error("Error", "El campo de código está vacío.");
      return;
    }
    findAndDisplayCode(trimmed);
    addToHistory(trimmed);
    notify.success("Operación exitosa", "Código de barras generado correctamente");
  };

  const handleGenerateFromHistory = (code: string) => {
    setEanCode(code);
    findAndDisplayCode(code);
  };

  const clearGenerator = () => {
    setEanCode("");
    setGeneratedCode("");
    setFoundProductName(null);
    setSelectedHistoryCode(null);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) {
        clearGenerator();
      }
    }}>
      <DialogContent className="sm:max-w-3xl p-0 max-h-[90vh] overflow-y-auto gap-0 rounded-xl">
        <DialogHeader className="p-6 border-b bg-muted/30">
          <DialogTitle className="flex items-center gap-2">
            <Barcode className="w-5 h-5" />
            Generar EAN manualmente
          </DialogTitle>
          <DialogDescription>
            Ingresa un código o selecciónalo del historial para generar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x">
          {/* Columna Izquierda: Visualizador */}
          <div className="p-6 flex flex-col justify-center items-center min-h-[300px] bg-background">
            {generatedCode ? (
              <div id="barcode-to-print" className="w-full text-center space-y-6">
                <div>
                  {foundProductName ? (
                    <h3 className="text-lg font-semibold leading-tight">{foundProductName}</h3>
                  ) : (
                    <p className="text-sm text-muted-foreground">Producto no encontrado en la base de datos.</p>
                  )}
                </div>
                <div className="p-4 bg-white rounded-lg inline-block shadow-sm border">
                  <BarcodeDisplay value={generatedCode} />
                </div>
                <div className="flex justify-center gap-2">
                  <Button size="sm" variant="outline" onClick={async () => { await navigator.clipboard.writeText(generatedCode); notify.success("Operación exitosa", "Código copiado"); }}>
                    <Copy className="w-4 h-4 mr-2" /> Copiar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => window.print()}>
                    <Printer className="w-4 h-4 mr-2" /> Imprimir
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-2 text-muted-foreground">
                <Barcode className="w-12 h-12 mx-auto opacity-20" />
                <p>Ingresa un código para generar el código de barras</p>
              </div>
            )}
          </div>

          {/* Columna Derecha: Historial */}
          <div className="p-6 bg-muted/10 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                Historial Reciente
              </h3>
              {history.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearHistory} className="h-6 text-xs text-muted-foreground hover:text-destructive px-2">
                  Borrar todo
                </Button>
              )}
            </div>

            {history.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 max-h-[250px] overflow-y-auto pr-2">
                {history.slice(0, 8).map((item) => (
                  <button
                    key={item.timestamp}
                    onClick={() => handleGenerateFromHistory(item.code)}
                    className={`text-left px-3 py-2 rounded-md text-sm font-mono transition-colors flex items-center justify-between group ${selectedHistoryCode === item.code
                      ? "bg-primary text-primary-foreground"
                      : "bg-background border hover:border-primary/50"
                      }`}
                  >
                    <span>{item.code}</span>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-xs text-muted-foreground border-2 border-dashed rounded-lg">
                Sin historial reciente
              </div>
            )}
          </div>
        </div>

        {/* Parte Inferior: Input y Botones */}
        <div className="p-6 bg-muted/30 border-t">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="space-y-2 flex-1 w-full">
              <Label htmlFor="ean-code">Código manual</Label>
              <div className="flex gap-2">
                <Input
                  id="ean-code"
                  value={eanCode}
                  onChange={(e) => setEanCode(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleGenerateFromInput();
                    }
                  }}
                  placeholder="Ej: 7791234567890"
                  className="font-mono"
                />
                <Button onClick={handleGenerateFromInput}>Generar</Button>
              </div>
            </div>
            <Button variant="ghost" onClick={clearGenerator}>Limpiar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
