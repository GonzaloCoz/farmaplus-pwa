import { useState, useMemo, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { CounterAnimation } from "@/components/CounterAnimation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Upload, FileSpreadsheet, AlertCircle, TrendingDown, TrendingUp, Download, CheckCircle, Target, Save, Calculator, Package } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { SaveReportModal } from "@/components/SaveReportModal";
import { FabMenu } from "@/components/FabMenu";

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
  topShortagesByValue: ProductData[];
  topSurplusesByValue: ProductData[];
  netDiscrepancyValue: number;
  netDiscrepancyUnits: number;
  totalScannedUnits: number;
}

export default function StockImport() {
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [originalData, setOriginalData] = useState<{ headers: any[], rows: any[][] }>({ headers: [], rows: [] });
  const [viewMode, setViewMode] = useState<"value" | "quantity">("value");
  const [hasExported, setHasExported] = useState(false);
  const [saveReportOpen, setSaveReportOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [downloadFileName, setDownloadFileName] = useState("Inventario");
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        selectedFile.type === "application/vnd.ms-excel") {
        setFile(selectedFile);
        setResults(null); // Limpiar resultados anteriores al cargar un nuevo archivo
        setOriginalData({ headers: [], rows: [] });
        toast.success("Archivo cargado correctamente");
      } else {
        toast.error("Por favor, selecciona un archivo Excel válido");
      }
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      toast.error("Por favor, selecciona un archivo primero");
      return;
    }

    setAnalyzing(true);
    toast.info("Analizando archivo...", { id: "analysis-toast" });

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[worksheetName];
      const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      const headers = json[0];
      const rows = json.slice(1);

      // Asumiendo que la primera fila es el encabezado y la saltamos.
      const products: ProductData[] = json.slice(1).map(row => ({
        codebar: row[6], // Columna G
        name: row[10], // Columna K
        physicalCount: Number(row[13]) || 0, // Columna N
        systemStock: Number(row[15]) || 0, // Columna P
        diffQty: Number(row[17]) || 0, // Columna R
        cost: Number(row[19]) || 0, // Columna T
        salePrice: Number(row[21]) || 0, // Columna V
        diffValue: Number(row[22]) || 0, // Columna W
      })).filter(p => p.codebar && p.name); // Filtrar filas vacías

      setOriginalData({ headers, rows });

      const allShortages = products.filter(p => p.diffQty < 0);
      const allSurpluses = products.filter(p => p.diffQty > 0);
      const noDifferenceCount = products.filter(p => p.diffQty === 0).length;
      const inventoryAccuracy = products.length > 0 ? (noDifferenceCount / products.length) * 100 : 100;

      const totalShortageValue = allShortages.reduce((acc, p) => acc + p.diffValue, 0);
      const totalSurplusValue = allSurpluses.reduce((acc, p) => acc + p.diffValue, 0);

      const totalShortageUnits = allShortages.reduce((acc, p) => acc + p.diffQty, 0);
      const totalSurplusUnits = allSurpluses.reduce((acc, p) => acc + p.diffQty, 0);

      const topShortagesByValue = [...allShortages].sort((a, b) => a.diffValue - b.diffValue).slice(0, 10);
      const topSurplusesByValue = [...allSurpluses].sort((a, b) => b.diffValue - a.diffValue).slice(0, 10);

      setResults({
        totalProducts: products.length,
        allShortages,
        allSurpluses,
        topShortagesByValue,
        topSurplusesByValue,
        totalShortageValue: Math.abs(totalShortageValue),
        totalSurplusValue: totalSurplusValue,
        totalShortageUnits: Math.abs(totalShortageUnits),
        totalSurplusUnits: totalSurplusUnits,
        inventoryAccuracy: inventoryAccuracy,
        totalProductsNoDifference: noDifferenceCount,
        netDiscrepancyValue: totalSurplusValue + totalShortageValue,
        netDiscrepancyUnits: totalSurplusUnits + totalShortageUnits,
        totalScannedUnits: products.reduce((acc, curr) => acc + curr.physicalCount, 0),
      });

      toast.success("Análisis completado", { id: "analysis-toast" });

      // Smooth scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    } catch (error) {
      console.error("Error analyzing file:", error);
      toast.error("Hubo un error al analizar el archivo.", { id: "analysis-toast" });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExportSummary = () => {
    if (!results) {
      toast.error("No hay resultados para exportar.");
      return;
    }

    toast.info("Generando resumen en Excel...");

    const formatForSheet = (data: ProductData[]) => data.map(item => ({
      'Código de Barras': item.codebar,
      'Producto': item.name,
      'Diferencia (Unidades)': item.diffQty,
      'Valor Diferencia ($)': item.diffValue,
      'Stock Sistema': item.systemStock,
      'Conteo Físico': item.physicalCount,
      'Costo Unitario ($)': item.cost,
      'Precio Venta ($)': item.salePrice,
    }));

    const shortagesByQty = [...results.allShortages].sort((a, b) => a.diffQty - b.diffQty).slice(0, 15);
    const shortagesByValue = [...results.allShortages].sort((a, b) => a.diffValue - b.diffValue).slice(0, 15);
    const surplusesByQty = [...results.allSurpluses].sort((a, b) => b.diffQty - a.diffQty).slice(0, 15);
    const surplusesByValue = [...results.allSurpluses].sort((a, b) => b.diffValue - a.diffValue).slice(0, 15);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(formatForSheet(shortagesByQty)), "Faltantes por Cantidad");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(formatForSheet(shortagesByValue)), "Faltantes por Valor");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(formatForSheet(surplusesByQty)), "Sobrantes por Cantidad");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(formatForSheet(surplusesByValue)), "Sobrantes por Valor");

    XLSX.writeFile(workbook, "Resumen_Diferencias.xlsx");
    toast.success("Resumen Excel generado correctamente.");
  };


  const handleExportForAdjustment = () => {
    if (!results || originalData.rows.length === 0) {
      toast.error("No hay resultados para exportar.");
      return;
    }

    // Abrimos el diálogo para que el usuario elija el nombre del archivo
    setExportDialogOpen(true);
  };

  const handleDownloadExport = () => {
    if (!results || originalData.rows.length === 0) {
      toast.error("No hay resultados para exportar.");
      return;
    }

    toast.info("Generando archivo Excel...");

    // Preparamos los nuevos encabezados
    const newHeaders = [...originalData.headers];
    newHeaders[24] = "ID DE AJUSTE"; // Columna Y
    newHeaders[25] = "CANTIDAD DE AJUSTE"; // Columna Z

    // Preparamos las filas con las fórmulas
    const dataForSheet = originalData.rows.map((row, index) => {
      const rowIndex = index + 2; // +2 porque Excel es 1-based y tenemos una fila de encabezado
      const newRow = [...row];

      // Aseguramos que los valores numéricos sean correctos para las fórmulas
      // Esto evita problemas si el Excel original tenía formatos de texto o valores nulos
      newRow[13] = Number(row[13]) || 0; // N: Conteo Físico
      newRow[15] = Number(row[15]) || 0; // P: Stock Sistema
      newRow[19] = Number(row[19]) || 0; // T: Costo
      newRow[21] = Number(row[21]) || 0; // V: Precio Venta

      // Columna R (17): Nueva Diferencia (Unidades)
      // (Conteo Físico [N] + CANTIDAD AJUSTE [Z]) - Stock Sistema [P]
      newRow[17] = { f: `(N${rowIndex}+Z${rowIndex})-P${rowIndex}` };

      // Columna W (22): Nuevo Valor Diferencia
      // Nueva Diferencia [R] * Costo [T]
      newRow[22] = { f: `R${rowIndex}*T${rowIndex}` };

      // Columnas para entrada manual
      newRow[24] = ''; // ID DE AJUSTE (Y)
      newRow[25] = 0;   // CANTIDAD DE AJUSTE (Z)
      return newRow;
    });

    const worksheet = XLSX.utils.aoa_to_sheet([newHeaders, ...dataForSheet]);

    // --- Lógica para ocultar columnas ---
    const totalCols = newHeaders.length;
    const colsVisibility = [];

    // 1. Por defecto, ocultar todas las columnas
    for (let i = 0; i < totalCols; i++) {
      colsVisibility.push({ hidden: true });
    }

    // 2. Hacer visibles solo las columnas deseadas
    const visibleColumns = [
      6,  // G
      10, // K
      13, // N
      15, // P
      17, // R
      19, // T
      21, // V
      22, // W
      24, // Y (ID DE AJUSTE)
      25, // Z (CANTIDAD DE AJUSTE)
    ];

    visibleColumns.forEach(colIndex => {
      if (colsVisibility[colIndex]) {
        colsVisibility[colIndex] = { hidden: false, wch: 20 }; // Hacer visible y ajustar ancho
      }
    });

    worksheet['!cols'] = colsVisibility;
    // --- Fin de la lógica para ocultar columnas ---

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Hoja de Ajuste");
    const finalFileName = `${downloadFileName}.xlsx`;
    XLSX.writeFile(workbook, finalFileName);
    toast.success("Archivo Excel generado correctamente.");
    setHasExported(true);
    setExportDialogOpen(false);
    setDownloadFileName("Inventario"); // Reset
  };

  const displayedShortages = useMemo(() => {
    if (!results) return [];
    if (viewMode === 'quantity') {
      return [...results.allShortages]
        .sort((a, b) => a.diffQty - b.diffQty)
        .slice(0, 10);
    }
    // Default to value
    return [...results.allShortages]
      .sort((a, b) => a.diffValue - b.diffValue)
      .slice(0, 10);
  }, [results, viewMode]);

  const displayedSurpluses = useMemo(() => {
    if (!results) return [];
    if (viewMode === 'quantity') {
      return [...results.allSurpluses]
        .sort((a, b) => b.diffQty - a.diffQty)
        .slice(0, 10);
    }
    // Default to value
    return [...results.allSurpluses]
      .sort((a, b) => b.diffValue - a.diffValue)
      .slice(0, 10);
  }, [results, viewMode]);

  const getDisplayValue = (item: ProductData) => {
    if (viewMode === 'quantity') {
      return `${item.diffQty} uds.`;
    }
    return `$${item.diffValue.toLocaleString()}`;
  };

  const getDisplaySubtext = (item: ProductData) => {
    if (viewMode === 'quantity') {
      return `Valor: $${item.diffValue.toLocaleString()}`;
    }
    const unitText = Math.abs(item.diffQty) === 1 ? 'unidad' : 'unidades';
    const prefix = item.diffQty > 0 ? '+' : '';
    return `Diferencia: ${prefix}${item.diffQty} ${unitText}`;
  }

  const handleSaveReport = (data: { name: string; branch: string; sector: string; date: string }) => {
    if (!results) {
      toast.error("No hay resultados para guardar");
      return;
    }

    const report = {
      id: Date.now().toString(),
      name: data.name,
      branch: data.branch,
      sector: data.sector,
      date: data.date,
      timestamp: new Date().toISOString(),
      results: results,
    };

    const existingReports = JSON.parse(localStorage.getItem("inventory-reports") || "[]");
    existingReports.push(report);
    localStorage.setItem("inventory-reports", JSON.stringify(existingReports));

    setSaveReportOpen(false);
  }

  return (
    <motion.div
      className="p-6 space-y-6 pb-32 lg:pb-10"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >


      <Card className="p-8">
        <div className="space-y-6">
          <div className="flex items-center justify-center w-full">
            <label
              htmlFor="dropzone-file"
              className="flex flex-col items-center justify-center w-full h-64 border-2 border-border border-dashed rounded-2xl cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-12 h-12 mb-4 text-muted-foreground" />
                <p className="mb-2 text-sm text-foreground font-medium">
                  {file ? file.name : "Haz clic para cargar o arrastra el archivo"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Archivos Excel (.xlsx, .xls)
                </p>
              </div>
              <input
                id="dropzone-file"
                type="file"
                className="hidden"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
              />
            </label>
          </div>

          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
            <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                Formato requerido
              </p>
              <p className="text-xs text-muted-foreground">
                El archivo debe contener las columnas: Código, Producto, Stock Sistema, Stock Físico, Diferencia
              </p>
            </div>
          </div>

          <Button
            onClick={handleAnalyze}
            disabled={!file || analyzing}
            className="w-full"
            size="lg"
          >
            {analyzing ? "Analizando..." : "Analizar Inventario"}
          </Button>
        </div>
      </Card>

      {results && (
        <motion.div
          ref={resultsRef}
          className="space-y-6"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: { staggerChildren: 0.1 }
              }
            }}
          >
            {/* Fila Superior */}
            <motion.div variants={{ hidden: { opacity: 0, scale: 0.9 }, show: { opacity: 1, scale: 1 } }}>
              <Card className="p-6 border-destructive/20">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-destructive/10 rounded-lg">
                    <TrendingDown className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Valor Faltantes</p>
                    <p className="text-2xl font-bold text-destructive">
                      <CounterAnimation value={results.totalShortageValue} prefix="$" />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <CounterAnimation value={results.totalShortageUnits} suffix=" unidades" />
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={{ hidden: { opacity: 0, scale: 0.9 }, show: { opacity: 1, scale: 1 } }}>
              <Card className="p-6 border-warning/20">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-warning/10 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Discrepancia</p>
                    <p className="text-2xl font-bold text-warning">
                      <CounterAnimation value={results.totalShortageValue + results.totalSurplusValue} prefix="$" />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <CounterAnimation value={results.totalShortageUnits + results.totalSurplusUnits} suffix=" unidades en total" />
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={{ hidden: { opacity: 0, scale: 0.9 }, show: { opacity: 1, scale: 1 } }}>
              <Card className="p-6 border-success/20">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-success/10 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Valor Sobrantes</p>
                    <p className="text-2xl font-bold text-success">
                      <CounterAnimation value={results.totalSurplusValue} prefix="$" />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      +<CounterAnimation value={results.totalSurplusUnits} suffix=" unidades" />
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={{ hidden: { opacity: 0, scale: 0.9 }, show: { opacity: 1, scale: 1 } }}>
              <Card className="p-6 border-blue-500/20">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Calculator className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Cálculo Original (Neto)</p>
                    <p className={`text-2xl font-bold ${results.netDiscrepancyValue < 0 ? "text-destructive" : "text-success"}`}>
                      <CounterAnimation value={results.netDiscrepancyValue} prefix="$" />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <CounterAnimation value={results.netDiscrepancyUnits} suffix=" unidades netas" />
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={{ hidden: { opacity: 0, scale: 0.9 }, show: { opacity: 1, scale: 1 } }}>
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-muted rounded-lg">
                    <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Productos</p>
                    <p className="text-2xl font-bold text-foreground">
                      <CounterAnimation value={results.totalProducts} />
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={{ hidden: { opacity: 0, scale: 0.9 }, show: { opacity: 1, scale: 1 } }}>
              <Card className="p-6 bg-primary/5 border-primary/20">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Unidades Escaneadas</p>
                    <p className="text-2xl font-bold text-primary">
                      <CounterAnimation value={results.totalScannedUnits} />
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={{ hidden: { opacity: 0, scale: 0.9 }, show: { opacity: 1, scale: 1 } }}>
              <Card className="p-6 border-primary/20">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Productos sin Diferencia</p>
                    <p className="text-2xl font-bold text-primary">
                      <CounterAnimation value={results.totalProductsNoDifference} />
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={{ hidden: { opacity: 0, scale: 0.9 }, show: { opacity: 1, scale: 1 } }}>
              <Card className="p-6 border-primary/20">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Target className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Precisión del Inventario</p>
                    <p className="text-2xl font-bold text-primary">
                      <CounterAnimation value={results.inventoryAccuracy} decimals={2} suffix="%" />
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          </motion.div>

          <div className="flex justify-between items-center">
            <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as any)} className="w-fit">
              <TabsList>
                <TabsTrigger value="value" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground hover:bg-primary hover:text-primary-foreground">Ver por Valor ($)</TabsTrigger>
                <TabsTrigger value="quantity" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground hover:bg-primary hover:text-primary-foreground">Ver por Cantidad (Uds.)</TabsTrigger>
              </TabsList>
            </Tabs>


          </div>



          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <TrendingDown className="w-5 h-5 text-destructive" />
                <h2 className="text-xl font-semibold text-foreground">
                  Productos con Más Faltantes
                </h2>
              </div>

              <div className="space-y-4">
                {displayedShortages.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-destructive/5 rounded-lg border border-destructive/20">
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {getDisplaySubtext(item)}
                      </p>
                    </div>
                    <p className="text-lg font-bold text-destructive">
                      {getDisplayValue(item)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-5 h-5 text-success" />
                <h2 className="text-xl font-semibold text-foreground">
                  Productos con Más Sobrantes
                </h2>
              </div>

              <div className="space-y-4">
                {displayedSurpluses.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-success/5 rounded-lg border border-success/20">
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {getDisplaySubtext(item)}
                      </p>
                    </div>
                    <p className="text-lg font-bold text-success">
                      {getDisplayValue(item)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="p-6 bg-muted/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-warning mt-1" />
              <div>
                <h3 className="font-medium text-foreground mb-2">Recomendaciones</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Revisar los productos con mayor diferencia para verificar posibles errores de conteo</li>
                  <li>• Investigar las causas de los faltantes más significativos</li>
                  <li>• Ajustar el stock en el sistema según los resultados del inventario físico</li>
                  <li>• Programar inventarios cíclicos más frecuentes para productos con alta variación</li>
                </ul>
              </div>
            </div>
          </Card>
          <FabMenu
            actions={[
              {
                label: 'Guardar Reporte',
                icon: <Save className="w-5 h-5" />,
                onClick: () => setSaveReportOpen(true),
                variant: 'default',
                color: 'bg-primary text-primary-foreground',
                disabled: !hasExported
              },
              {
                label: 'Exportar Inventario',
                icon: <Download className="w-5 h-5" />,
                onClick: handleExportForAdjustment,
                variant: 'secondary'
              },
              {
                label: 'Exportar Resumen',
                icon: <FileSpreadsheet className="w-5 h-5" />,
                onClick: handleExportSummary,
                variant: 'secondary',
                color: 'text-green-600'
              }
            ]}
          />
        </motion.div>
      )}

      <SaveReportModal
        open={saveReportOpen}
        onOpenChange={setSaveReportOpen}
        onSave={handleSaveReport}
      />

      {/* Diálogo para descargar el archivo de inventario */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="w-[420px]">
          <DialogHeader>
            <DialogTitle>Exportar Inventario</DialogTitle>
            <DialogDescription>
              Ingresa el nombre del archivo que deseas descargar. Se guardará como un archivo Excel (.xlsx).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label htmlFor="fileName" className="block text-sm font-medium text-foreground mb-2">
                Nombre del archivo
              </label>
              <Input
                id="fileName"
                type="text"
                placeholder="Inventario"
                value={downloadFileName}
                onChange={(e) => setDownloadFileName(e.target.value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-2">
                La extensión .xlsx se agregará automáticamente
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setExportDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleDownloadExport}
                disabled={!downloadFileName.trim()}
              >
                Descargar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
