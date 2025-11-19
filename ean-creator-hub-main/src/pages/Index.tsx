import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, Keyboard, Barcode } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gradient-start/10 via-background to-gradient-end/10">
      <div className="container max-w-4xl mx-auto px-6 py-12">
        <div className="text-center space-y-4 mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
            <Barcode className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">
            Generador de Códigos EAN
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Crea y escanea códigos de barras EAN-13 de forma rápida y sencilla
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card
            className="p-8 hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer bg-card border-2 hover:border-primary"
            onClick={() => navigate("/manual")}
          >
            <div className="space-y-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
                <Keyboard className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-foreground">
                  Ingreso Manual
                </h2>
                <p className="text-muted-foreground">
                  Ingresa manualmente el código EAN-13 y genera el código de barras
                  para escanear o imprimir
                </p>
              </div>
              <Button className="w-full" size="lg">
                Comenzar
              </Button>
            </div>
          </Card>

          <Card
            className="p-8 hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer bg-card border-2 hover:border-primary"
            onClick={() => navigate("/scanner")}
          >
            <div className="space-y-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
                <Camera className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-foreground">
                  Escanear con Cámara
                </h2>
                <p className="text-muted-foreground">
                  Usa la cámara para detectar y escanear códigos de barras
                  automáticamente
                </p>
              </div>
              <Button className="w-full" size="lg">
                Escanear
              </Button>
            </div>
          </Card>
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            Compatible con códigos EAN-13 estándar
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
