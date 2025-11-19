import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarcodeDisplay } from "@/components/BarcodeDisplay";
import { BarcodeHistory } from "@/components/BarcodeHistory";
import { useBarcodeHistory } from "@/hooks/use-barcode-history";
import { ArrowLeft, Scan } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const ManualEntry = () => {
  const [eanCode, setEanCode] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { history, addToHistory, clearHistory } = useBarcodeHistory();

  const handlePrint = () => {
    window.print();
  };

  const handleGenerate = () => {
    const trimmedCode = eanCode.trim();
    
    if (!trimmedCode) {
      toast({
        title: "Error",
        description: "Por favor ingresa un código",
        variant: "destructive",
      });
      return;
    }

    if (!/^\d+$/.test(trimmedCode)) {
      toast({
        title: "Error",
        description: "El código debe contener solo números",
        variant: "destructive",
      });
      return;
    }

    // Validación para EAN-13 (12 o 13 dígitos)
    if (trimmedCode.length < 12 || trimmedCode.length > 13) {
      toast({
        title: "Longitud de código inválida",
        description: "Para un código EAN-13, por favor ingresa 12 o 13 dígitos.",
        variant: "destructive",
      });
      return;
    }

    setGeneratedCode(trimmedCode);
    addToHistory(trimmedCode);
    toast({
      title: "¡Éxito!",
      description: "Código de barras generado correctamente",
    });
  };

  const handleSelectFromHistory = (code: string) => {
    setEanCode(code);
    setGeneratedCode(code);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gradient-start/10 via-background to-gradient-end/10">
      <div className="container max-w-2xl mx-auto p-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>

        <div className="bg-card rounded-3xl shadow-xl p-8 space-y-8">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Scan className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Ingreso Manual</h1>
            <p className="text-muted-foreground">
              Ingresa tu código para generar el código de barras
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ean-code" className="text-base">
                Código de barras
              </Label>
              <Input
                id="ean-code"
                type="text"
                placeholder="Ej: 1234567890 o 123"
                value={eanCode}
                onChange={(e) => setEanCode(e.target.value.replace(/\D/g, ""))}
                className="text-lg h-12"
              />
              <p className="text-sm text-muted-foreground">
                Ingresa cualquier código numérico de tu empresa
              </p>
            </div>

            <Button
              onClick={handleGenerate}
              className="w-full h-12 text-base"
              size="lg"
            >
              Generar Código de Barras
            </Button>
          </div>

          {generatedCode && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <BarcodeDisplay value={generatedCode} onPrint={handlePrint} />
            </div>
          )}

          <BarcodeHistory
            history={history}
            onSelectCode={handleSelectFromHistory}
            onClearHistory={clearHistory}
          />
        </div>
      </div>
    </div>
  );
};

export default ManualEntry;
