import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, FileText, TrendingUp, TrendingDown, Package, CheckCircle, Target, Calendar, MapPin, Layers } from "lucide-react";
import { toast } from "sonner";

// Interfaces de Reporte
interface ProductData {
  codebar: string;
  name: string;
  physicalCount: number;
  systemStock: number;
  diffQty: number;
  cost: number;
  salePrice: number;
  diffValue: number;
}

interface AnalysisResults {
  totalProducts: number;
  totalShortageValue: number;
  totalSurplusValue: number;
  totalShortageUnits: number;
  totalSurplusUnits: number;
  inventoryAccuracy: number;
  totalProductsNoDifference: number;
  allShortages: ProductData[];
  allSurpluses: ProductData[];
}

interface Report {
  id: string;
  name: string;
  branch: string;
  sector: string;
  date: string;
  timestamp: string;
  results: AnalysisResults;
}

export default function ReportDetail() {
  const { reportId } = useParams<{ reportId: string }>();
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    try {
      const storedReports: Report[] = JSON.parse(localStorage.getItem("inventory-reports") || "[]");
      const foundReport = storedReports.find(r => r.id === reportId);
      if (foundReport) {
        setReport(foundReport);
      } else {
        toast.error("No se pudo encontrar el reporte.");
      }
    } catch (error) {
      toast.error("Error al cargar los reportes.");
    }
  }, [reportId]);

  if (!report) {
    return (
      <div className="p-6 text-center">
        <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium">Reporte no encontrado</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          El reporte que buscas no existe o ha sido eliminado.
        </p>
        <Button asChild variant="link" className="mt-4">
          <Link to="/reports">Volver a Reportes</Link>
        </Button>
      </div>
    );
  }

  const { results } = report;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link to="/reports">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">{report.name}</h1>
          <div className="flex items-center gap-6 text-sm text-muted-foreground mt-2">
            <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {report.branch}</div>
            <div className="flex items-center gap-2"><Layers className="h-4 w-4" /> {report.sector}</div>
            <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /> {new Date(report.date).toLocaleDateString("es-ES")}</div>
          </div>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="p-6 border-destructive/20">
          <div className="flex items-center gap-3"><TrendingDown className="w-5 h-5 text-destructive" /> <p className="text-sm text-muted-foreground">Valor Faltantes</p></div>
          <p className="text-2xl font-bold text-destructive">${results.totalShortageValue.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">{results.totalShortageUnits} unidades</p>
        </Card>
        <Card className="p-6 border-success/20">
          <div className="flex items-center gap-3"><TrendingUp className="w-5 h-5 text-success" /> <p className="text-sm text-muted-foreground">Valor Sobrantes</p></div>
          <p className="text-2xl font-bold text-success">${results.totalSurplusValue.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">+{results.totalSurplusUnits} unidades</p>
        </Card>
        <Card className="p-6 border-primary/20">
          <div className="flex items-center gap-3"><Target className="h-5 w-5 text-primary" /> <p className="text-sm text-muted-foreground">Precisión</p></div>
          <p className="text-2xl font-bold text-primary">{results.inventoryAccuracy.toFixed(2)}%</p>
          <p className="text-xs text-muted-foreground">{results.totalProductsNoDifference} de {results.totalProducts} productos</p>
        </Card>
      </div>

      {/* Tablas de Faltantes y Sobrantes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Productos Faltantes ({results.allShortages.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Diferencia</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.allShortages.map((item) => (
                    <TableRow key={item.codebar}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-right">{item.diffQty}</TableCell>
                      <TableCell className="text-right text-destructive">${Math.abs(item.diffValue).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Productos Sobrantes ({results.allSurpluses.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Diferencia</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.allSurpluses.map((item) => (
                    <TableRow key={item.codebar}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-right">+{item.diffQty}</TableCell>
                      <TableCell className="text-right text-success">${item.diffValue.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
