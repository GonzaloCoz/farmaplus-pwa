import { useState } from 'react';
import { motion } from 'framer-motion';
import productsData from '../data/products.json';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useBarcodeHistory } from "@/hooks/use-barcode-history";
import { BarcodeDisplay } from "@/components/BarcodeDisplay";
import { Copy, Printer } from "lucide-react";
import { Fab } from "@/components/Fab";

interface Product {
  Codebar: number | string;
  Producto: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
};

export default function Products() {
  // --- Estados para la lista de productos y búsqueda ---
  const [searchTerm, setSearchTerm] = useState('');

  // --- Estados y lógica para el generador EAN ---
  const [open, setOpen] = useState(false);
  const [eanCode, setEanCode] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [foundProductName, setFoundProductName] = useState<string | null>(null);
  const [selectedHistoryCode, setSelectedHistoryCode] = useState<string | null>(null);
  const { history, addToHistory, clearHistory } = useBarcodeHistory();

  const findAndDisplayCode = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed || !/^\d+$/.test(trimmed)) {
      toast.error("Por favor, ingresa un código numérico válido.");
      return;
    }

    const foundProduct = productsData.find(
      (p: Product) => String(p.Codebar) === trimmed
    );

    setFoundProductName(foundProduct ? foundProduct.Producto : null);
    setGeneratedCode(trimmed);
    setSelectedHistoryCode(trimmed);
  };

  const handleGenerateFromInput = () => {
    const trimmed = eanCode.trim();
    if (!trimmed) {
      toast.error("El campo de código está vacío.");
      return;
    }
    findAndDisplayCode(trimmed);
    addToHistory(trimmed);
    toast.success("Código de barras generado correctamente");
  };

  const handleGenerateFromHistory = (code: string) => {
    setEanCode(code);
    findAndDisplayCode(code);
  };

  // Filtra los productos basándose en el término de búsqueda.
  // Busca tanto en el nombre del producto como en el código de barras.
  const filteredProducts = productsData.filter((product: Product) => {
    const term = searchTerm.toLowerCase();
    return product.Producto.toLowerCase().includes(term) || String(product.Codebar).includes(term);
  });

  // Función para limpiar el estado del generador
  const clearGenerator = () => {
    setEanCode("");
    setGeneratedCode("");
    setFoundProductName(null);
    setSelectedHistoryCode(null);
  };

  const handleRowClick = (product: Product) => {
    const code = String(product.Codebar);
    setEanCode(code);
    findAndDisplayCode(code);
    setOpen(true);
  };

  return (
    <motion.div
      className="p-6 space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Base de Datos de Productos</h1>
        <p className="text-muted-foreground">Busca y consulta los productos existentes.</p>
      </div>

      {/* Input de búsqueda */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar por nombre o código de barras..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-2 border rounded-md bg-background"
        />
      </div>

      {/* Lista de productos filtrados */}
      <div className="border rounded-lg overflow-hidden">
        {filteredProducts.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-3 font-medium">Código de Barras</th>
                <th className="p-3 font-medium">Producto</th>
              </tr>
            </thead>
            <motion.tbody
              variants={containerVariants}
              initial="hidden"
              animate="show"
            >
              {filteredProducts.slice(0, 100).map((product, index) => ( // Mostramos solo los primeros 100 para mejor rendimiento
                <motion.tr
                  key={`${product.Codebar}-${index}`}
                  variants={itemVariants}
                  className="border-t hover:bg-muted/50 cursor-pointer"
                  onClick={() => handleRowClick(product)}
                >
                  <td className="p-3 font-mono">{String(product.Codebar)}</td>
                  <td className="p-3">{product.Producto}</td>
                </motion.tr>
              ))}
            </motion.tbody>
          </table>
        ) : (
          <p className="text-center p-6">
            No se encontraron productos con el término "{searchTerm}".
          </p>
        )}
        {filteredProducts.length > 100 && (
          <p className="text-center p-4 text-sm text-muted-foreground">... y {filteredProducts.length - 100} más. Afina tu búsqueda para ver más resultados.</p>
        )}
      </div>

      {/* --- Dialog para Generar EAN --- */}
      <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          clearGenerator(); // Limpia el estado cuando se cierra el diálogo
        }
      }}>
        <DialogContent className="sm:max-w-3xl p-0 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="p-6 pb-4">
              <DialogTitle>Generar EAN manualmente</DialogTitle>
              <DialogDescription>Ingresa un código, selecciónalo del historial o haz clic en la tabla para generar.</DialogDescription>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-6">
            {/* Columna Izquierda: Visualizador */}
            <div className="border rounded-lg p-6 text-center bg-background flex flex-col justify-center items-center min-h-[250px]">
              {generatedCode ? (
                <div id="barcode-to-print" className="w-full">
                  {foundProductName ? (
                    <h3 className="text-lg font-semibold mb-4">{foundProductName}</h3>
                  ) : (
                    <p className="text-sm text-muted-foreground mb-4">Producto no encontrado en la base de datos.</p>
                  )}
                  <BarcodeDisplay value={generatedCode} />
                  <div className="flex justify-center gap-2 mt-4">
                    <Button size="sm" variant="outline" onClick={async () => { await navigator.clipboard.writeText(generatedCode); toast.success("Código copiado"); }}><Copy className="w-4 h-4 mr-2" /> Copiar</Button>
                    <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" /> Imprimir</Button>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Ingresa un código para visualizarlo aquí.</p>
              )}
            </div>

            {/* Columna Derecha: Historial */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Historial</h3>
                {history.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearHistory}>Limpiar</Button>
                )}
              </div>
              {history.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 border rounded-lg p-3 max-h-[250px] overflow-y-auto">
                  {history.slice(0, 8).map((item) => (
                    <Button
                      key={item.timestamp}
                      variant={selectedHistoryCode === item.code ? "default" : "outline"}
                      className="font-mono text-xs h-auto py-2 justify-center"
                      onClick={() => handleGenerateFromHistory(item.code)}
                    >
                      {item.code}
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="text-center text-sm text-muted-foreground border rounded-lg p-10">El historial está vacío.</div>
              )}
            </div>
          </div>

          {/* Parte Inferior: Input y Botones */}
          <div className="p-6 bg-muted/50 border-t mt-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="ean-code">Código de barras a generar</Label>
                <Input
                  id="ean-code"
                  value={eanCode}
                  onChange={(e) => setEanCode(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleGenerateFromInput();
                    }
                  }}
                  placeholder="Ej: 123456789012"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleGenerateFromInput} className="flex-1">Generar</Button>
                <Button variant="ghost" onClick={clearGenerator}>Limpiar</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Fab onClick={() => setOpen(true)} />
    </motion.div>
  );
}