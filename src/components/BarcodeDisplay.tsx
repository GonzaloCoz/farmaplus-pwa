import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeDisplayProps {
  value: string;
}

export function BarcodeDisplay({ value }: BarcodeDisplayProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: 'CODE128',
        width: 2,
        height: 80,
        displayValue: true,
        fontOptions: 'bold',
        fontSize: 18,
        background: 'transparent',
        lineColor: '#000000',
      });
    } catch (err) {
      console.error('Error generating barcode SVG:', err);
    }
  }, [value]);

  return (
    <div className="flex justify-center">
      <svg ref={svgRef} />
    </div>
  );
}
