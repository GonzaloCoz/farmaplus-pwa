import { QRCodeCanvas } from 'qrcode.react';
import { cn } from '@/lib/utils';

interface QRPrintLayoutProps {
    quantities: Record<string, number>;
    branchName?: string;
}

export function QRPrintLayout({ quantities, branchName }: QRPrintLayoutProps) {
    // Generar la lista completa de etiquetas basada en las cantidades
    const labels = Object.entries(quantities).flatMap(([prefix, count]) => {
        return Array.from({ length: count }, (_, i) => ({
            code: `${prefix}-${(i + 1).toString().padStart(2, '0')}`,
            name: getPrefixName(prefix)
        }));
    });

    return (
        <div id="qr-print-area" className="bg-white min-h-screen p-8 text-black print:p-0 print:m-0 print:bg-white">
            {/* Header visible solo en pantalla, no en impresión (opcional) */}
            <div className="mb-8 border-b pb-4 print:hidden">
                <h1 className="text-2xl font-bold">Vista Previa de Impresión: Etiquetas QR</h1>
                <p className="text-sm text-gray-500">Sucursal: {branchName || 'Farmacia Generic'}</p>
            </div>

            {/* Grilla de etiquetas optimizada para A4 */}
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 print:grid-cols-4 print:gap-4 print:w-full">
                {labels.map((label) => (
                    <div 
                        key={label.code} 
                        className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 p-4 rounded-xl aspect-square bg-white print:border-gray-200 print:rounded-none print:shadow-none"
                    >
                        <div className="bg-white p-2 mb-2">
                            <QRCodeCanvas 
                                value={label.code} 
                                size={120}
                                level="H"
                                includeMargin={false}
                            />
                        </div>
                        <span className="text-[10px] uppercase tracking-tighter font-black text-gray-400 mb-0.5">
                            {label.name}
                        </span>
                        <span className="text-sm font-bold tracking-tight">
                            {label.code}
                        </span>
                    </div>
                ))}
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page {
                        size: A4;
                        margin: 1cm;
                    }
                    /* Ocultar elementos específicos de la interfaz general */
                    nav, aside, header, footer, 
                    [data-sidebar], .sidebar, 
                    .print\\:hidden {
                        display: none !important;
                    }

                    /* Limpiar el contenedor principal para que no tenga sombras ni bordes */
                    main, .Frame, [class*="Frame"] {
                        margin: 0 !important;
                        padding: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                        background: transparent !important;
                    }

                    #qr-print-area {
                        display: block !important;
                        background: white !important;
                        width: 100% !important;
                    }

                    /* Asegurar que los QR y el texto salgan en negro */
                    canvas, span, div {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                }
            `}} />
        </div>
    );
}

function getPrefixName(prefix: string): string {
    const names: Record<string, string> = {
        'GO': 'Góndola',
        'CA': 'Cajón',
        'HE': 'Heladera',
        'DE': 'Depósito',
        'ES': 'Estantería',
        'PA': 'Pasillo',
        'AN': 'Anexo'
    };
    return names[prefix] || 'Ubicación';
}
