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

```

### 2. Actualización del Sistema de Rutas

Añado la nueva ruta en `src/App.tsx` para que se pueda acceder a la vista de detalle.

```diff
--- a/src/App.tsx
+++ b/src/App.tsx
@@ -9,6 +9,7 @@
 import Cyclic from "./pages/Cyclic";
 import Products from "./pages/Products";
 import Reports from "./pages/Reports";
+import ReportDetail from "./pages/ReportDetail";
 import Settings from "./Settings";
 import NotFound from "./pages/NotFound";
 
@@ -21,6 +22,7 @@
             <Route path="/cyclic" element={<AppLayout><Cyclic /></AppLayout>} />
             <Route path="/products" element={<AppLayout><Products /></AppLayout>} />
             <Route path="/reports" element={<AppLayout><Reports /></AppLayout>} />
+            <Route path="/reports/:reportId" element={<AppLayout><ReportDetail /></AppLayout>} />
             <Route path="/settings" element={<AppLayout><Settings /></AppLayout>} />
             {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
             <Route path="*" element={<NotFound />} />

```

### 3. Modificación de la Lista de Reportes

Finalmente, convierto cada tarjeta de reporte en un enlace que dirige a la nueva página de detalle.

```diff
--- a/src/pages/Reports.tsx
+++ b/src/pages/Reports.tsx
@@ -5,6 +5,7 @@
 import { FileText, Trash2, Download, Search, Calendar, MapPin, Layers } from "lucide-react";
 import * as XLSX from "xlsx";
 import { toast } from "sonner";
+import { Link } from "react-router-dom";
 
 interface Report {
   id: string;
@@ -134,30 +135,32 @@
       ) : (
         <div className="space-y-3">
           {filteredReports.map((report) => (
-            <Card key={report.id} className="p-4">
-              <div className="flex items-start justify-between">
-                <div className="flex-1">
-                  <h3 className="font-semibold text-foreground">{report.name}</h3>
-                  <div className="grid grid-cols-3 gap-4 mt-3">
-                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
-                      <MapPin className="h-4 w-4" />
-                      <span>{report.branch}</span>
-                    </div>
-                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
-                      <Layers className="h-4 w-4" />
-                      <span>{report.sector}</span>
-                    </div>
-                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
-                      <Calendar className="h-4 w-4" />
-                      <span>{new Date(report.date).toLocaleDateString("es-ES")}</span>
-                    </div>
-                  </div>
-                  <p className="text-xs text-muted-foreground mt-2">
-                    Guardado: {new Date(report.timestamp).toLocaleString("es-ES")}
-                  </p>
-                </div>
-                <div className="flex gap-2">
+            <Link to={`/reports/${report.id}`} key={report.id} className="block hover:bg-muted/50 rounded-lg transition-colors">
+              <Card className="p-4 cursor-pointer">
+                <div className="flex items-start justify-between">
+                  <div className="flex-1">
+                    <h3 className="font-semibold text-foreground">{report.name}</h3>
+                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
+                      <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /><span>{report.branch}</span></div>
+                      <div className="flex items-center gap-2"><Layers className="h-4 w-4" /><span>{report.sector}</span></div>
+                      <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /><span>{new Date(report.date).toLocaleDateString("es-ES")}</span></div>
+                    </div>
+                  </div>
+                  <div className="flex gap-2">
                   <Button
                     size="sm"
                     variant="outline"
@@ -174,10 +177,10 @@
                   >
                     <Trash2 className="h-4 w-4" />
                   </Button>
-                </div>
-              </div>
-            </Card>
+                  </div>
+                </div>
+              </Card>
+            </Link>
           ))}
         </div>
       )}

```

¡Listo! Ahora, en la página de "Reportes", cada reporte será un elemento clickeable. Al hacer clic, te llevará a su página de detalle donde verás un resumen de las métricas y las tablas completas de productos faltantes y sobrantes.

<!--
[PROMPT_SUGGESTION]¿Podemos agregar gráficos a la vista de detalle del reporte?[/PROMPT_SUGGESTION]
[PROMPT_SUGGESTION]¿Cómo puedo ordenar las listas de productos en la vista de detalle?[/PROMPT_SUGGESTION]
-->