import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

interface InventoryDetail {
  cluster: string;
  laboratory: string;
  countDate: string;
  boxes: number;
  physicalCount: number;
  totalCost: number;
  difference: number;
  validated: string;
  adjusted: string;
}

interface CategoryData {
  name: string;
  totalCost: number;
  totalDifference: number;
  items: InventoryDetail[];
}

export default function CyclicInventory() {
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branchName, setBranchName] = useState("Cargando...");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    toast.info("Cargando datos del inventario cíclico...");

    try {
      const response = await fetch('/seguimiento_ciclico.xlsx');
      if (!response.ok) {
        throw new Error("No se pudo encontrar el archivo 'seguimiento_ciclico.xlsx' en la carpeta 'public'.");
      }
      const data = await response.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });

      // Extraer nombre de la sucursal de la primera hoja "Consolidado - Alcance"
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      // Asumo que el nombre está en una celda específica, ej: A1. Ajustar si es necesario.
      const branchCell = firstSheet['A1'] ? firstSheet['A1'].v : "Sucursal";
      setBranchName(branchCell);

      const categorySheets = ["Medicamentos", "Perfumeria", "Accesorios", "Varios"];
      const allCategoriesData: CategoryData[] = [];

      for (const sheetName of categorySheets) {
        if (workbook.SheetNames.includes(sheetName)) {
          const worksheet = workbook.Sheets[sheetName];
          const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: "A9:I999" });

          const items: InventoryDetail[] = json
            .map(row => ({
              cluster: row[0], // A9
              laboratory: row[1], // B9
              countDate: row[2], // C9
              boxes: Number(row[3]) || 0, // D9
              physicalCount: Number(row[4]) || 0, // E9
              totalCost: Number(row[5]) || 0, // F9
              difference: Number(row[6]) || 0, // G9
              validated: row[7], // H9
              adjusted: row[8], // I9
            }))
            .filter(item => item.laboratory); // Filtrar filas vacías

          const totalCost = items.reduce((acc, item) => acc + item.totalCost, 0);
          const totalDifference = items.reduce((acc, item) => acc + item.difference, 0);

          allCategoriesData.push({
            name: sheetName,
            totalCost,
            totalDifference,
            items,
          });
        }
      }

      setCategories(allCategoriesData);
      toast.success("Datos cargados correctamente.");
    } catch (e: any) {
      console.error("Error loading cyclic inventories:", e);
      setError(e.message || "Ocurrió un error al cargar los datos.");
      toast.error(e.message || "Ocurrió un error al cargar los datos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Seguimiento Cíclico: {branchName}
          </h1>
          <p className="text-muted-foreground">
            Dashboard con el detalle del inventario por categoría y laboratorio.
          </p>
        </div>
        <Button onClick={loadData} variant="outline" disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar Datos
        </Button>
      </div>

      {loading && <div className="p-6 text-center text-muted-foreground">Cargando datos...</div>}
      {error && <div className="p-6 text-center text-destructive">{error}</div>}

      {!loading && !error && categories.length > 0 && (
        <div className="space-y-8">
          {categories.map((category) => (
            <Card key={category.name} className="overflow-hidden">
              <div className="p-6 bg-muted/30 border-b">
                <h2 className="text-2xl font-semibold text-foreground">{category.name}</h2>
                <div className="flex gap-8 mt-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">Costo Total: </span>
                    <span className="font-medium">${Math.abs(category.totalCost).toLocaleString()}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Diferencia Total: </span>
                    <span className={`font-medium ${category.totalDifference >= 0 ? 'text-success' : 'text-destructive'}`}>
                      ${category.totalDifference.toLocaleString()}
                    </span>
                  </p>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Laboratorio</TableHead>
                    <TableHead>Fecha Conteo</TableHead>
                    <TableHead className="text-right">Costo Total</TableHead>
                    <TableHead className="text-right">Diferencia</TableHead>
                    <TableHead className="text-center">Validado</TableHead>
                    <TableHead className="text-center">Ajustado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {category.items.map((item, index) => (
                    <TableRow key={`${category.name}-${index}`}>
                      <TableCell className="font-medium">{item.laboratory}</TableCell>
                      <TableCell>{item.countDate}</TableCell>
                      <TableCell className="text-right">${item.totalCost.toLocaleString()}</TableCell>
                      <TableCell className={`text-right font-semibold ${item.difference >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {item.difference.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.validated && <CheckCircle className="h-5 w-5 text-success mx-auto" />}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.adjusted && <CheckCircle className="h-5 w-5 text-success mx-auto" />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {category.items.length === 0 && (
                <div className="p-6 text-center text-muted-foreground">
                  No hay datos para esta categoría.
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {!loading && !error && categories.length === 0 && (
         <Card className="p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">No se encontraron datos</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              El archivo no contiene las hojas esperadas (Medicamentos, Perfumeria, etc.) o están vacías.
            </p>
         </Card>
      )}
    </div>
  );
}
