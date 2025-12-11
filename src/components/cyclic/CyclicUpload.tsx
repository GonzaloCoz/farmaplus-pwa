import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { ChangeEvent } from 'react';

interface CyclicUploadProps {
    onFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
    isLoading: boolean;
    labName: string;
}

export function CyclicUpload({ onFileUpload, isLoading, labName }: CyclicUploadProps) {
    return (
        <Card className="p-8 md:p-12 border-dashed border-2 flex flex-col items-center justify-center text-center space-y-6 bg-muted/20 hover:bg-muted/30 transition-colors animate-in fade-in zoom-in duration-300">
            <div className="p-6 bg-primary/10 rounded-full ring-8 ring-primary/5">
                <FileSpreadsheet className="w-12 h-12 text-primary" />
            </div>
            <div>
                <h3 className="text-xl font-bold">Comenzar Inventario</h3>
                <p className="text-muted-foreground max-w-sm mx-auto mt-2 text-sm leading-relaxed">
                    Sube el archivo Excel de PLEX para cargar los productos del laboratorio <strong className="text-foreground">{labName}</strong>.
                </p>
            </div>
            <div className="relative group">
                <Button size="lg" disabled={isLoading} className="px-8 shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
                    {isLoading ? 'Procesando...' : 'Seleccionar Archivo Excel'}
                    <Upload className="ml-2 w-4 h-4" />
                </Button>
                <Input
                    type="file"
                    accept=".xlsx, .xls"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={onFileUpload}
                    disabled={isLoading}
                />
            </div>
            <p className="text-[10px] text-muted-foreground pt-4 border-t w-full max-w-xs uppercase tracking-wide">
                Formatos soportados: .xlsx, .xls
            </p>
        </Card>
    );
}
