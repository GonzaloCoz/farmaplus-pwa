import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";

interface BarcodeDisplayProps {
  value: string;
  onPrint?: () => void;
}

export const BarcodeDisplay = ({ value, onPrint }: BarcodeDisplayProps) => {
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (barcodeRef.current && value) {
      try {
        // Auto-detect format based on length
        let format = "CODE128"; // Default format for custom codes
        
        if (value.length === 13) {
          format = "EAN13";
        } else if (value.length === 8) {
          format = "EAN8";
        }

        JsBarcode(barcodeRef.current, value, {
          format: format,
          width: 2,
          height: 100,
          displayValue: true,
          fontSize: 14,
          margin: 10,
        });
      } catch (error) {
        console.error("Error generating barcode:", error);
      }
    }
  }, [value]);

  const handleDownload = () => {
    if (barcodeRef.current) {
      const svg = barcodeRef.current;
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svg);
      const blob = new Blob([svgString], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `barcode-${value}.svg`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-6 bg-card rounded-2xl shadow-lg">
      <svg ref={barcodeRef} className="max-w-full" />
      <div className="flex gap-2">
        <Button
          onClick={onPrint}
          variant="default"
          size="sm"
          className="gap-2"
        >
          <Printer className="h-4 w-4" />
          Imprimir
        </Button>
        <Button
          onClick={handleDownload}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Descargar
        </Button>
      </div>
    </div>
  );
};
