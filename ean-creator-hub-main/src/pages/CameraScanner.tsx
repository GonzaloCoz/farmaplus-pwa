import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { BarcodeDisplay } from "@/components/BarcodeDisplay";
import { BarcodeHistory } from "@/components/BarcodeHistory";
import { useBarcodeHistory } from "@/hooks/use-barcode-history";
import { ArrowLeft, Camera, CameraOff, Upload, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

const CameraScanner = () => {
  const [scanning, setScanning] = useState(false);
  const [scannedCode, setScannedCode] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { history, addToHistory, clearHistory } = useBarcodeHistory();

  const handlePrint = () => {
    window.print();
  };

  const handleSelectCode = (code: string) => {
    setScannedCode(code);
  };

  const onScanSuccess = (decodedText: string, decodedResult: any) => {
    if (scanning) {
      stopScanning(false); // No limpiar el código escaneado
      setScannedCode(decodedText);
      addToHistory(decodedText);
      toast({
        title: "¡Código escaneado!",
        description: `Detectado: ${decodedText}`,
      });
    }
  };

  const onScanFailure = () => {
    // Error callback - silent
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const html5QrCode = new Html5Qrcode("reader", { verbose: false });
      try {
        const decodedText = await html5QrCode.scanFile(file, false);
        onScanSuccess(decodedText, null);
      } catch (err) {
        toast({
          title: "Error al escanear",
          description: "No se pudo encontrar un código de barras en la imagen.",
          variant: "destructive",
        });
      }
    }
  };

  const startScanning = async () => {
    // Evitar iniciar si ya está en proceso o si no estamos en el cliente
    if (scanning || typeof window === 'undefined') return;

    const readerElement = document.getElementById("reader");
    if (!readerElement) return;
    const qrCodeScanner = new Html5Qrcode(readerElement, {
      verbose: false,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.ITF,
      ],
    });
    scannerRef.current = qrCodeScanner;
    setScanning(true);

    try {
      await qrCodeScanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
          aspectRatio: 1.0,
        },
        onScanSuccess,
        onScanFailure
      );
    } catch (err) {
      console.error("Error starting scanner:", err);
      setScanning(false);
      toast({
        title: "Error de Cámara",
        description: "No se pudo acceder a la cámara. Verifica los permisos y que no esté en uso.",
        variant: "destructive",
      });
    }
  };

  const stopScanning = async (clearCode = true) => {
    if (scannerRef.current?.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
    }
    if (clearCode) {
      setScannedCode("");
    }
    // Limpiar la referencia y el estado independientemente de si hubo un error al detener
    scannerRef.current = null;
    setScanning(false);
  };

  useEffect(() => {
    // Este efecto se encarga de la limpieza cuando el usuario abandona la página.
    // Ya no iniciaremos el escáner automáticamente.
    return () => {
      // Aseguramos que la cámara se detenga si el componente se desmonta.
      if (scannerRef.current?.isScanning) stopScanning();
    };
  }, []);

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
              <Camera className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Escanear con Cámara</h1>
            <p className="text-muted-foreground">
              Activa la cámara para escanear códigos de barras
            </p>
          </div>

          <div className="space-y-4">
            {!scanning && !scannedCode ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Button onClick={startScanning} className="w-full h-12 text-base" size="lg">
                  <Camera className="h-5 w-5 mr-2" />
                  Activar Cámara
                </Button>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="w-full h-12 text-base"
                  size="lg"
                >
                  <Upload className="h-5 w-5 mr-2" />
                  Escanear Archivo
                </Button>
              </div>
            ) : null}

            {scannedCode && !scanning && (
               <Button onClick={() => { setScannedCode(""); startScanning(); }} className="w-full h-12 text-base" size="lg">
                  <RefreshCw className="h-5 w-5 mr-2" />
                  Escanear de nuevo
                </Button>
            )}


            {scanning && (
              <div className="space-y-4">
                <Button onClick={stopScanning} variant="destructive" className="w-full h-12 text-base" size="lg">
                  <CameraOff className="h-5 w-5 mr-2" />
                  Detener
                </Button>
                <p className="text-sm text-center text-muted-foreground animate-pulse">
                  Apuntando con la cámara al código de barras...
                </p>
              </div>
            )}

            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

            <div
              id="reader"
              className="w-full rounded-2xl overflow-hidden bg-scanner-bg border-2 border-scanner-frame transition-all duration-300"
              style={{
                minHeight: scanning ? "300px" : "0px",
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {!scanning && <div className="p-4 text-center text-muted-foreground">La cámara se activará aquí.</div>}
            </div>
          </div>

          {scannedCode && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Código detectado:</p>
                <p className="text-xl font-bold font-mono text-foreground">{scannedCode}</p>
              </div>
              <BarcodeDisplay value={scannedCode} onPrint={handlePrint} />
            </div>
          )}

          <BarcodeHistory
            history={history}
            onSelectCode={handleSelectCode}
            onClearHistory={clearHistory}
          />
        </div>
      </div>
    </div>
  );
};

export default CameraScanner;
