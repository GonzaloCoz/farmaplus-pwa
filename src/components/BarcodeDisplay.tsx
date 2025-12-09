import Barcode from 'react-barcode';

interface BarcodeDisplayProps {
  value: string;
}

export function BarcodeDisplay({ value }: BarcodeDisplayProps) {
  return (
    <div className="flex justify-center">
      <Barcode
        value={value}
        format="CODE128"
        width={2}
        height={80}
        displayValue={true}
        fontOptions="bold"
        fontSize={18}
        background="transparent"
        lineColor="#000000"
      />
    </div>
  );
}