import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useBarcodeHistory } from "@/hooks/use-barcode-history";
import { BarcodeDisplay } from "@/components/BarcodeDisplay";
import { Copy, Printer, Barcode, Search, ArrowLeft, Filter, X, Upload } from "lucide-react";
import { ProductImageHover } from "@/components/ProductImageHover";
import { useNavigate } from 'react-router-dom';
import { getAllProducts, Product, addProducts } from '@/services/preCountDB';
import * as XLSX from 'xlsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PageLayout } from '@/components/layout/PageLayout';
import { PageHeader } from '@/components/layout/PageHeader';

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
  const navigate = useNavigate();

  // --- Estados ---
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLab, setSelectedLab] = useState<string>('all');

  // --- Estados para el generador EAN ---
  const [open, setOpen] = useState(false);
  const [eanCode, setEanCode] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [foundProductName, setFoundProductName] = useState<string | null>(null);
  const [selectedHistoryCode, setSelectedHistoryCode] = useState<string | null>(null);
  const { history, addToHistory, clearHistory } = useBarcodeHistory();

  // Cargar productos al iniciar
  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        const data = await getAllProducts();
        setProducts(data);
      } catch (error) {
        console.error("Error loading products:", error);
        toast.error("Error al cargar los productos");
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, []);

  // Obtener lista única de laboratorios
  const uniqueLabs = useMemo(() => {
    const labs = new Set(products.map(p => p.laboratory).filter(Boolean));
    return Array.from(labs).sort();
  }, [products]);

  // Filtrar productos
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        product.name.toLowerCase().includes(term) ||
        product.ean.includes(term);

      const matchesLab = selectedLab === 'all' || product.laboratory === selectedLab;

      return matchesSearch && matchesLab;
    });
  }, [products, searchTerm, selectedLab]);

  // --- Lógica del Generador EAN ---

  const findAndDisplayCode = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed || !/^\d+$/.test(trimmed)) {
      toast.error("Por favor, ingresa un código numérico válido.");
      return;
    }

    const foundProduct = products.find(p => p.ean === trimmed);

    setFoundProductName(foundProduct ? foundProduct.name : null);
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

  const clearGenerator = () => {
    setEanCode("");
    setGeneratedCode("");
    setFoundProductName(null);
    setSelectedHistoryCode(null);
  };

  const handleRowClick = (product: Product) => {
    setEanCode(product.ean);
    findAndDisplayCode(product.ean);
    setOpen(true);
  };

  // --- Bulk Upload Logic ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const reader = new FileReader();

      reader.onload = async (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws, { header: "A" });

          const newProducts: Product[] = [];

          for (let i = 1; i < data.length; i++) {
            const row: any = data[i];
            // Adjust these column keys based on your specific Excel format
            // Assuming standard format: D=Name, O=Lab, Q=EANs, J=Category, L=Cost
            const rawName = row["D"];
            const rawEans = row["Q"];

            if (!rawName || !rawEans) continue;

            const name = String(rawName).trim();
            const laboratory = row["O"] ? String(row["O"]).trim() : undefined;
            const category = row["J"] ? String(row["J"]).trim().toUpperCase() : undefined;
            const cost = row["L"] ? Number(row["L"]) : 0;

            const eanString = String(rawEans).trim();
            const eanList = eanString.split('-').map(e => e.trim()).filter(e => e.length > 0);

            eanList.forEach(ean => {
              newProducts.push({
                ean,
                name,
                laboratory,
                category,
                cost,
                salePrice: 0, // Default or map if available
                stock: 0
              });
            });
          }

          // Deduplicate products by EAN to prevent "ON CONFLICT DO UPDATE command cannot affect row a second time"
          const uniqueProductsMap = new Map();
          newProducts.forEach(p => {
            if (!uniqueProductsMap.has(p.ean)) {
              uniqueProductsMap.set(p.ean, p);
            }
          });
          const uniqueProducts = Array.from(uniqueProductsMap.values());

          if (uniqueProducts.length > 0) {
            // Upload in chunks
            const chunkSize = 1000;
            for (let i = 0; i < uniqueProducts.length; i += chunkSize) {
              const chunk = uniqueProducts.slice(i, i + chunkSize);
              await addProducts(chunk);
            }

            toast.success(`${uniqueProducts.length} productos actualizados correctamente.`);
            // Reload products
            const updatedData = await getAllProducts();
            setProducts(updatedData);
          } else {
            toast.warning("No se encontraron productos válidos en el archivo.");
          }

        } catch (error: any) {
          console.error("Error processing file:", error);
          toast.error(`Error: ${error.message || 'Error desconocido al procesar el archivo'}`);
        } finally {
          setLoading(false);
          // Reset input
          e.target.value = '';
        }
      };

      reader.readAsBinaryString(file);

    } catch (error) {
      console.error("Upload error:", error);
      setLoading(false);
    }
  };

  return (
    <PageLayout>
      <div className="flex justify-end gap-2 mb-4">
        <div className="relative">
          <Button variant="outline" disabled={loading} onClick={() => document.getElementById('product-upload')?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            {loading ? 'Cargando...' : 'Importar Excel'}
          </Button>
          <Input
            id="product-upload"
            type="file"
            accept=".xlsx, .xls"
            className="hidden"
            onChange={handleFileUpload}
            disabled={loading}
          />
        </div>
        <Button onClick={() => setOpen(true)}>
          <Barcode className="w-4 h-4 mr-2" />
          Generar EAN
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
              <p>Cargando productos...</p>
            </div>
          ) : filteredProducts.length > 0 ? (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[140px]">EAN</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="hidden md:table-cell">Laboratorio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.slice(0, 100).map((product) => (
                  <TableRow
                    key={product.ean}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(product)}
                  >
                    <TableCell className="font-mono text-primary font-medium">
                      {product.ean}
                    </TableCell>
                    <TableCell>
                      <ProductImageHover ean={product.ean} name={product.name}>
                        <div className="font-medium hover:underline decoration-dotted underline-offset-4 w-fit">
                          {product.name}
                        </div>
                      </ProductImageHover>
                      <div className="md:hidden text-xs text-muted-foreground mt-1">
                        {product.laboratory || 'Sin laboratorio'}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {product.laboratory ? (
                        <Badge variant="outline" className="font-normal">
                          {product.laboratory}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
              <Search className="w-12 h-12 mb-4 opacity-20" />
              <p>No se encontraron productos.</p>
              {selectedLab !== 'all' && (
                <Button
                  variant="link"
                  onClick={() => setSelectedLab('all')}
                  className="mt-2"
                >
                  Limpiar filtros
                </Button>
              )}
            </div>
          )}

          {!loading && filteredProducts.length > 100 && (
            <div className="p-4 text-center border-t bg-muted/20">
              <p className="text-xs text-muted-foreground">
                Mostrando 100 de {filteredProducts.length} resultados.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* --- Dialog para Generar EAN --- */}
      <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
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
              Ingresa un código, selecciónalo del historial o haz clic en la tabla para generar.
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
                    <Button size="sm" variant="outline" onClick={async () => { await navigator.clipboard.writeText(generatedCode); toast.success("Código copiado"); }}>
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
                  <p>Selecciona un producto o ingresa un código</p>
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
    </PageLayout>
  );
}