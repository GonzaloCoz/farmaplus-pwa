import { useState, useMemo, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { FixedSizeList as List } from "react-window";
import type { ListChildComponentProps } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import { ProductImageHover } from "@/components/ProductImageHover";
import { cn } from "@/lib/utils";
import { CounterAnimation } from "@/components/CounterAnimation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Upload, FileSpreadsheet, AlertCircle, TrendingDown, TrendingUp, Download, CheckCircle, Target, Save, Calculator, Package, Search, Filter, ChevronDown, ListFilter, Wallet, ArrowUpRight, ArrowDownRight, MoreHorizontal, ArrowLeftRight, ArrowUpDown, Check, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";
import { notify } from "@/lib/notifications";
import { SaveReportModal } from "@/components/SaveReportModal";
import { FabMenu } from "@/components/FabMenu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

interface ProductData {
  codebar: string;
  name: string;
  physicalCount: number | string;
  systemStock: number;
  diffQty: number;
  cost: number;
  salePrice: number;
  diffValue: number;
  rowIndex: number; // Index in originalData.rows
}

type SortField = 'quantity' | 'value';
type SortDirection = 'asc' | 'desc'; // Desc = Mayor a menor (magnitud), Asc = Menor a mayor

interface SortConfig {
  field: SortField;
  direction: SortDirection;
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
  allProducts: ProductData[];
}

interface NegativeItem {
  codebar: string;
  name: string;
  quantity: number;
  price: number;
  totalValue: number;
  rowIndex: number;
}

interface AnalysisResultsNegative {
  totalProducts: number;
  totalUnits: number;
  totalValue: number;
  items: NegativeItem[];
}

type ImportMode = 'inventory' | 'negative_preview' | 'collaborative_inventory';


// Virtualized Row Component
const Row = ({ index, style, data }: ListChildComponentProps) => {
  const { items, editingRow, handleStartEditing, handleStopEditing, handleQuantityChange } = data;
  const item = items[index];

  return (
    <div style={style} className="px-4">
      <div
        className="grid grid-cols-12 gap-4 h-full items-center border-b border-border/40 hover:bg-muted/10 transition-colors group"
      >
        {/* Product Info */}
        <div className="col-span-5 md:col-span-4 flex items-center gap-3 pl-2 min-w-0">
          <div className={cn("p-2 rounded-lg shrink-0", item.diffQty < 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success')}>
            {item.diffQty < 0 ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <ProductImageHover ean={item.codebar} name={item.name}>
              <p className="font-semibold text-sm text-foreground truncate" title={item.name}>{item.name}</p>
            </ProductImageHover>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className="text-[10px] h-5 font-mono text-muted-foreground border-border/60 font-normal hidden sm:inline-flex">
                {item.codebar}
              </Badge>
              <span className="text-[10px] text-muted-foreground sm:hidden">{item.codebar}</span>
            </div>
          </div>
        </div>

        {/* Price */}
        <div className="col-span-2 text-right hidden md:block self-center">
          <p className="text-sm font-medium">${item.cost.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">Costo Unit.</p>
        </div>

        {/* Difference (Pill) */}
        <div className="col-span-3 md:col-span-2 flex justify-center self-center">
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold w-20 justify-center",
            item.diffQty < 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
          )}>
            {item.diffQty > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {item.diffQty > 0 ? '+' : ''}{item.diffQty}
          </div>
        </div>

        {/* Physical / System */}
        <div className="col-span-2 text-center hidden sm:block self-center">
          <div className="flex items-center justify-center gap-1 text-sm relative">
            {editingRow === item.rowIndex ? (
              <Input
                type="number"
                autoFocus
                className="w-16 h-7 text-right pr-2 font-bold p-0"
                value={item.physicalCount}
                onBlur={handleStopEditing}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleStopEditing();
                }}
                onChange={(e) => handleQuantityChange(item.rowIndex, e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div
                className="w-16 h-7 flex items-center justify-end pr-2 relative cursor-pointer group/edit rounded hover:bg-muted/50 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartEditing(item.rowIndex);
                }}
              >
                <span className="font-bold">{item.physicalCount}</span>
                <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover/edit:opacity-100 transition-opacity absolute left-1" />
              </div>
            )}
            <span className="text-muted-foreground mx-1">/</span>
            <span className="text-muted-foreground">{item.systemStock}</span>
          </div>
        </div>

        {/* Total Value & Actions */}
        <div className="col-span-2 md:col-span-2 text-right pr-2 self-center">
          <p className={cn(
            "text-sm font-bold",
            item.diffValue < 0 ? 'text-destructive' : 'text-success'
          )}>
            {item.diffValue > 0 ? '+' : ''}${Math.abs(item.diffValue).toLocaleString()}
          </p>
          <div className="flex justify-end mt-1 md:hidden">
            <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default function StockImport() {
  const [importMode, setImportMode] = useState<ImportMode>('inventory');
  const [file, setFile] = useState<File | null>(null);
  const [filePartial, setFilePartial] = useState<File | null>(null); // For collaborative mode (Step 1)
  const [fileComplete, setFileComplete] = useState<File | null>(null); // For collaborative mode (Step 2)
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [negativeResults, setNegativeResults] = useState<AnalysisResultsNegative | null>(null);
  const [originalData, setOriginalData] = useState<{ headers: any[], rows: any[][] }>({ headers: [], rows: [] });

  const [hasExported, setHasExported] = useState(false);
  const [saveReportOpen, setSaveReportOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [downloadFileName, setDownloadFileName] = useState("Inventario");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "shortage" | "surplus" | "match" | "zero_stock">("all");
  const [negativeFilter, setNegativeFilter] = useState<"all" | "positive" | "negative">("negative");
  const [showDiscrepancy, setShowDiscrepancy] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'value', direction: 'desc' });
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [frozenSortIndices, setFrozenSortIndices] = useState<number[] | null>(null);

  // Collaborative State
  const [collaborativeResults, setCollaborativeResults] = useState<{
    partial: AnalysisResults,
    branch: AnalysisResults,
    general: AnalysisResults
  } | null>(null);
  const [collaborativeTab, setCollaborativeTab] = useState<'partial' | 'branch' | 'general'>('general');

  const resultsRef = useRef<HTMLDivElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        selectedFile.type === "application/vnd.ms-excel") {
        setFile(selectedFile);
        setResults(null); // Limpiar resultados anteriores al cargar un nuevo archivo
        setNegativeResults(null);
        setOriginalData({ headers: [], rows: [] });
        notify.success("Operación exitosa", "Archivo cargado correctamente");
      } else {
        notify.error("Error", "Por favor, selecciona un archivo Excel válido");
      }
    }
  };

  const handlePartialFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (isValidExcel(selectedFile)) {
      setFilePartial(selectedFile!);
      notify.success("Operación exitosa", "Stock Parcial cargado");
    } else {
      notify.error("Error", "Archivo inválido");
    }
  };

  const handleCompleteFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (isValidExcel(selectedFile)) {
      setFileComplete(selectedFile!);
      notify.success("Operación exitosa", "Stock Completo cargado");
    } else {
      notify.error("Error", "Archivo inválido");
    }
  };

  const isValidExcel = (file: File | undefined | null) => {
    return file && (file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.type === "application/vnd.ms-excel");
  };

  const calculateAnalysisResults = (rows: any[]): AnalysisResults => {
    // Mapeamos usando el índice original del array para poder actualizar luego
    const products: ProductData[] = rows.map((row, index) => ({
      codebar: row[6], // Columna G
      name: row[10], // Columna K
      physicalCount: row[13] === "" ? "" : (Number(row[13]) || 0), // Columna N - Allow empty string
      systemStock: Number(row[15]) || 0, // Columna P
      diffQty: Number(row[17]) || 0, // Columna R
      cost: Number(row[19]) || 0, // Columna T
      salePrice: Number(row[21]) || 0, // Columna V
      diffValue: Number(row[22]) || 0, // Columna W
      rowIndex: index,
    })).filter(p => p.codebar && p.name); // Filtrar filas vacías

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

    return {
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
      totalScannedUnits: products.reduce((acc, curr) => acc + (Number(curr.physicalCount) || 0), 0),
      allProducts: products,
    };
  };

  const analyzeRows = (rows: any[]) => {
    const results = calculateAnalysisResults(rows);
    setResults(results);
  };

  const analyzeNegativePreview = (rows: any[]) => {
    const items: NegativeItem[] = rows.map((row, index) => ({
      codebar: row[2] ? String(row[2]) : "", // Columna C (Index 2)
      name: row[3] ? String(row[3]) : "",   // Columna D (Index 3)
      quantity: Number(row[4]) || 0,        // Columna E (Index 4)
      price: Number(row[10]) || 0,          // Columna K (Index 10)
      totalValue: (Number(row[4]) || 0) * (Number(row[10]) || 0),
      rowIndex: index
    })).filter(item => item.codebar && item.name); // Filter empty rows

    // Calculate totals
    const totalProducts = items.length;
    const totalUnits = items.reduce((acc, item) => acc + item.quantity, 0);
    const totalValue = items.reduce((acc, item) => acc + item.totalValue, 0);

    setNegativeResults({
      totalProducts,
      totalUnits,
      totalValue,
      items
    });
  };

  const handleAnalyze = async () => {
    if (!file) {
      notify.error("Error", "Por favor, selecciona un archivo primero");
      return;
    }

    setAnalyzing(true);
    notify.info("Información", "Analizando archivo...", { id: "analysis-toast" });

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[worksheetName];
      const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      const headers = json[0];
      const rows = json.slice(1);

      setOriginalData({ headers, rows });

      if (importMode === 'inventory') {
        analyzeRows(rows);
      } else {
        analyzeNegativePreview(rows);
      }

      notify.success("Operación exitosa", "Análisis completado", { id: "analysis-toast" });

      // Smooth scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    } catch (error) {
      console.error("Error analyzing file:", error);
      notify.error("Error", "Hubo un error al analizar el archivo.", { id: "analysis-toast" });
    } finally {
      setAnalyzing(false);
    }
  };

  const getColumnIndex = (headers: any[], possibleNames: string[], defaultIndex: number) => {
    if (!headers || headers.length === 0) return defaultIndex;
    const lowerHeaders = headers.map(h => String(h).toLowerCase().trim());
    for (const name of possibleNames) {
      const index = lowerHeaders.findIndex(h => h.includes(name.toLowerCase()));
      if (index !== -1) return index;
    }
    return defaultIndex;
  };

  const cleanEAN = (val: any) => {
    if (val === null || val === undefined) return "";
    return String(val).trim().replace(/[^0-9a-zA-Z]/g, ''); // Remove weird chars/spaces
  };

  const handleAnalyzeMerge = async () => {
    if (!filePartial || !fileComplete) {
      notify.error("Error", "Debes cargar ambos archivos.");
      return;
    }

    setAnalyzing(true);
    notify.info("Información", "Fusionando inventarios...", { id: "merge-toast" });

    try {
      // 1. Process Partial File (Our Count)
      const dataPartial = await filePartial.arrayBuffer();
      const wbPartial = XLSX.read(dataPartial);
      const wsPartial = wbPartial.Sheets[wbPartial.SheetNames[0]];
      const rawRowsPartial: any[][] = XLSX.utils.sheet_to_json(wsPartial, { header: 1 });

      const headersPartial = rawRowsPartial[0];
      const codeIndexPartial = getColumnIndex(headersPartial, ['codebar', 'código', 'codigo', 'ean'], 6);
      const qtyIndexPartial = getColumnIndex(headersPartial, ['físico', 'fisico', 'cantidad', 'physical'], 13);

      console.log(`Debug: Partial File - Code Code: ${codeIndexPartial}, Col Qty: ${qtyIndexPartial}`);

      // Map: Codebar -> Quantity
      const partialMap = new Map<string, number>();
      rawRowsPartial.slice(1).forEach(row => {
        const code = cleanEAN(row[codeIndexPartial]);
        const qty = Number(row[qtyIndexPartial]) || 0;
        if (code) {
          const current = partialMap.get(code) || 0;
          partialMap.set(code, current + qty);
        }
      });

      // 2. Process Complete File (Branch Count + System)
      const dataComplete = await fileComplete.arrayBuffer();
      const wbComplete = XLSX.read(dataComplete);
      const wsComplete = wbComplete.Sheets[wbComplete.SheetNames[0]];
      const rowsComplete: any[][] = XLSX.utils.sheet_to_json(wsComplete, { header: 1 }); // Includes Headers at 0

      const headers = rowsComplete[0];
      const dataRows = rowsComplete.slice(1);

      const codeIndexComplete = getColumnIndex(headers, ['codebar', 'código', 'codigo', 'ean'], 6);
      const qtyIndexComplete = getColumnIndex(headers, ['físico', 'fisico', 'cantidad', 'physical'], 13);
      const systemIndexComplete = getColumnIndex(headers, ['sistema', 'system'], 15);
      const costIndexComplete = getColumnIndex(headers, ['costo', 'cost'], 19);

      console.log(`Debug: Complete File - Col Code: ${codeIndexComplete}, Col Qty: ${qtyIndexComplete}`);

      // 3. Merge Logic & Partitioning

      // A. General (Merged) Rows
      const rowsGeneral = dataRows.map((row) => {
        const newRow = [...row];
        const code = cleanEAN(row[codeIndexComplete]);
        const partialQty = partialMap.get(code) || 0;
        const branchQty = Number(row[qtyIndexComplete]) || 0;
        const totalQty = branchQty + partialQty;

        newRow[13] = totalQty; // Force put into standard index 13 for internal consistency if using standard analysis

        // However, standard analysis relies on HARDCODED indices (13, 15, 17, etc.)
        // We should map our found indices to the "Analyzed Product" structure, 
        // BUT calculateAnalysisResults parses raw rows using HARDCODED indices.
        // We must update calculateAnalysisResults to use DYNAMIC indices too, or normalize the row structure here.
        // Normalizing row structure is safer for `calculateAnalysisResults`.

        // Let's NORMALIZE the row to fit `ProductData` expectation:
        // Col 6: Codebar, 10: Name, 13: Physical, 15: System, 17: Diff, 19: Cost, 22: DiffValue
        // We'll preserve the original row but overwrite these indices.
        // Actually, if we overwrite, we might overwrite original data if indices differ.
        // BUT calculateAnalysisResults reads from specific indices.
        // So we MUST ensure data is at those indices.

        // Let's use the found values to populate the fields correctly.

        newRow[6] = code;
        newRow[13] = totalQty;
        newRow[15] = Number(row[systemIndexComplete]) || 0;
        newRow[17] = totalQty - (Number(row[systemIndexComplete]) || 0);
        newRow[19] = Number(row[costIndexComplete]) || 0;
        newRow[22] = (totalQty - (Number(row[systemIndexComplete]) || 0)) * (Number(row[costIndexComplete]) || 0);

        return newRow;
      });

      // B. Partial Rows
      const rowsPartial = dataRows
        .filter(row => {
          const code = cleanEAN(row[codeIndexComplete]);
          return partialMap.has(code);
        })
        .map(row => {
          const newRow = [...row];
          const code = cleanEAN(row[codeIndexComplete]);
          const partialQty = partialMap.get(code) || 0;

          const systemStock = Number(row[systemIndexComplete]) || 0;
          const cost = Number(row[costIndexComplete]) || 0;

          newRow[6] = code;
          newRow[13] = partialQty;
          newRow[15] = systemStock;
          newRow[17] = partialQty - systemStock;
          newRow[19] = cost;
          newRow[22] = (partialQty - systemStock) * cost;

          return newRow;
        });

      // C. Branch Rows
      const rowsBranch = dataRows
        .filter(row => {
          const code = cleanEAN(row[codeIndexComplete]);
          return !partialMap.has(code);
        })
        .map(row => {
          const newRow = [...row];
          const code = cleanEAN(row[codeIndexComplete]);
          const branchQty = Number(row[qtyIndexComplete]) || 0;
          const systemStock = Number(row[systemIndexComplete]) || 0;
          const cost = Number(row[costIndexComplete]) || 0;

          newRow[6] = code;
          newRow[13] = branchQty;
          newRow[15] = systemStock;
          newRow[17] = branchQty - systemStock;
          newRow[19] = cost;
          newRow[22] = (branchQty - systemStock) * cost;

          return newRow;
        });

      // 4. Calculate Results
      const resGeneral = calculateAnalysisResults(rowsGeneral);
      const resPartial = calculateAnalysisResults(rowsPartial);
      const resBranch = calculateAnalysisResults(rowsBranch);

      if (partialMap.size === 0) {
        notify.warning("Advertencia", "No se encontraron productos en el Archivo Parcial (Codebar col G).");
      } else if (resPartial.totalProducts === 0) {
        notify.warning("Advertencia", "El Archivo Parcial no tuvo coincidencias con el Archivo Completo.");
        console.log("Debug: Partial Map Keys Sample:", [...partialMap.keys()].slice(0, 5));
        console.log("Debug: Complete File Keys Sample:", dataRows.slice(0, 5).map(r => r[6]));
      }

      if (resGeneral.totalProducts === 0) {
        notify.error("Error", "No se encontraron productos en el Archivo Completo.");
      }

      setCollaborativeResults({
        general: resGeneral,
        partial: resPartial,
        branch: resBranch
      });

      // Set initial view based on current tab, defaults to general if not set or just force update
      if (collaborativeTab === 'partial') setResults(resPartial);
      else if (collaborativeTab === 'branch') setResults(resBranch);
      else setResults(resGeneral);

      setOriginalData({ headers, rows: rowsGeneral }); // Keep General as "Original" for now

      notify.success("Operación exitosa", "Fusión completada", { id: "merge-toast" });
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);

    } catch (error) {
      console.error("Error merging:", error);
      notify.error("Error", "Error al fusionar archivos.", { id: "merge-toast" });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleQuantityChange = (rowIndex: number, newQuantity: string | number) => {
    // 1. Create a deep copy of rows to avoid mutating state directly
    const updatedRows = [...originalData.rows];
    const updatedRow = [...updatedRows[rowIndex]];
    updatedRows[rowIndex] = updatedRow;

    // 2. Update Physical Count (Column N / Index 13)
    updatedRow[13] = newQuantity;

    // 3. Recalculate Difference (Column R / Index 17)
    // Formula: Diff = Physical (13) - System (15)
    // Note: We need to parse System first just in case
    const qtyValue = newQuantity === "" ? 0 : Number(newQuantity);
    const systemStock = Number(updatedRow[15]) || 0;
    const diffQty = qtyValue - systemStock;
    updatedRow[17] = diffQty;

    // 4. Recalculate Diff Value (Column W / Index 22)
    // Formula: Diff Value = Diff Qty * Cost (19)
    const cost = Number(updatedRow[19]) || 0;
    updatedRow[22] = diffQty * cost;

    // 5. Update State and Re-Analyze
    setOriginalData(prev => ({ ...prev, rows: updatedRows }));
    analyzeRows(updatedRows);
  };

  const handleExportSummary = () => {
    if (!results) {
      notify.error("Error", "No hay resultados para exportar.");
      return;
    }

    notify.info("Información", "Generando resumen en Excel...");

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
    notify.success("Operación exitosa", "Resumen Excel generado correctamente.");
  };


  const handleExportForAdjustment = () => {
    if (!results || originalData.rows.length === 0) {
      notify.error("Error", "No hay resultados para exportar.");
      return;
    }

    // Abrimos el diálogo para que el usuario elija el nombre del archivo
    setExportDialogOpen(true);
  };

  const handleDownloadExport = () => {
    if (!results || originalData.rows.length === 0) {
      notify.error("Error", "No hay resultados para exportar.");
      return;
    }

    notify.info("Información", "Generando archivo Excel...");

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
    notify.success("Operación exitosa", "Archivo Excel generado correctamente.");
    setHasExported(true);
    setExportDialogOpen(false);
    setDownloadFileName("Inventario"); // Reset
  };

  const filteredProducts = useMemo(() => {
    if (!results) return [];

    let filtered = results.allShortages.concat(results.allSurpluses);

    // Also include matching products if viewing "all" or "match"
    // (Note: The original 'products' array isn't fully stored in 'results' except as aggregations, 
    // but looking at 'handleAnalyze', we see 'allShortages' and 'allSurpluses'. 
    // We need to access the full list to show "Match" or "All". 
    // The current 'results' interface separates shortages and surpluses.
    // We should probably check if we can get the non-diff products too or if we just show diffs.)

    // Correction: 'AnalysisResults' strictly has 'allShortages' and 'allSurpluses'. 
    // It does NOT have the full list of products without difference.
    // However, for this redesign, the user likely wants to see everything.
    // Let's modify the 'AnalysisResults' interface or logic in a future step if needed.
    // For now, we will combine shortages and surpluses. 
    // Wait, let's look at where 'filtered' comes from.
    // Actually, 'originalData' has everything, but it's raw rows.
    // Let's just work with what we have in 'results' for now (Shortages + Surpluses), 
    // and if the user wants 'All', we show both. 
    // Ideally we would refactor 'AnalysisResults' to include 'allProducts' but let's stick to the visible diffs for now 
    // as that's arguably the most important part of "Stock Import Analysis".

    // ACTUALLY, to be fully correct per the request "Importar Inventario", we usually want to see everything.
    // But let's start with Diffs as that is the current behavior scope.

    let items = [...results.allShortages, ...results.allSurpluses];

    // Filter by Tab
    if (activeTab === "shortage") {
      items = results.allShortages;
    } else if (activeTab === "surplus") {
      items = results.allSurpluses;
    } else if (activeTab === "match") {
      items = [];
    } else if (activeTab === "zero_stock") {
      // Stock 0 -> >0 (System Stock 0, Physical > 0)
      // These are a subset of surpluses
      items = results.allSurpluses.filter(p => p.systemStock === 0 && Number(p.physicalCount) > 0);
    }

    // Filter by Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.codebar.toLowerCase().includes(q)
      );
    }

    // Sort
    const sortedItems = items.sort((a, b) => {
      const valA = sortConfig.field === 'value' ? a.diffValue : a.diffQty;
      const valB = sortConfig.field === 'value' ? b.diffValue : b.diffQty;

      if (sortConfig.direction === 'desc') {
        return valB - valA; // 100 -> -100 (Mayor Positivo primero)
      } else {
        return valA - valB; // -100 -> 100 (Mayor Negativo primero)
      }
    });

    // FROZEN SORT LOGIC:
    // If we are editing, we want to KEEP the list exactly as it was when we started editing.
    // This prevents items from jumping around or disappearing while typing.
    if (editingRow !== null && frozenSortIndices && results.allProducts) {
      // Reconstruct the list using the frozen indices, but pulling FRESH data from results
      return frozenSortIndices
        .map(rowIndex => results.allProducts.find(p => p.rowIndex === rowIndex))
        .filter((p): p is ProductData => p !== undefined);
    }

    return sortedItems;
  }, [results, activeTab, searchQuery, sortConfig, editingRow, frozenSortIndices]);

  const handleStartEditing = (rowIndex: number) => {
    setEditingRow(rowIndex);
    // Freeze the current view's order
    setFrozenSortIndices(filteredProducts.map(p => p.rowIndex));
  };

  const handleStopEditing = () => {
    setEditingRow(null);
    setFrozenSortIndices(null); // Release the freeze, allowing re-sort
  };

  const handleSaveReport = (data: { name: string; branch: string; sector: string; date: string }) => {
    if (!results) {
      notify.error("Error", "No hay resultados para guardar");
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
          <Tabs defaultValue="inventory" value={importMode} onValueChange={(v) => {
            setImportMode(v as ImportMode);
            setResults(null);
            setNegativeResults(null);
            setFile(null); // Reset file to force re-selection or at least clear state
          }} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="inventory">Análisis de Inventario</TabsTrigger>
              <TabsTrigger value="negative_preview">Previsión Negativos</TabsTrigger>
              <TabsTrigger value="collaborative_inventory">Análisis Colaborativo</TabsTrigger>
            </TabsList>

            <div className="flex flex-col gap-4">
              {importMode === 'collaborative_inventory' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Partial File Upload */}
                  <label
                    className={cn(
                      "flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-2xl cursor-pointer transition-colors",
                      filePartial ? "border-success bg-success/5" : "border-border bg-muted/30 hover:bg-muted/50"
                    )}
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                      {filePartial ? <CheckCircle className="w-10 h-10 mb-3 text-success" /> : <Upload className="w-10 h-10 mb-3 text-muted-foreground" />}
                      <p className="mb-1 text-sm text-foreground font-medium">
                        {filePartial ? filePartial.name : "1. Cargar Stock Propio"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        El que controlamos nosotros
                      </p>
                    </div>
                    <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handlePartialFileChange} />
                  </label>

                  {/* Complete File Upload */}
                  <label
                    className={cn(
                      "flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-2xl cursor-pointer transition-colors",
                      fileComplete ? "border-success bg-success/5" : "border-border bg-muted/30 hover:bg-muted/50"
                    )}
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                      {fileComplete ? <CheckCircle className="w-10 h-10 mb-3 text-success" /> : <Upload className="w-10 h-10 mb-3 text-muted-foreground" />}
                      <p className="mb-1 text-sm text-foreground font-medium">
                        {fileComplete ? fileComplete.name : "2. Cargar Stock Sucursal"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        El archivo completo de sistema
                      </p>
                    </div>
                    <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleCompleteFileChange} />
                  </label>
                </div>
              ) : (
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
              )}
            </div>
          </Tabs>

          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
            <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                Formato requerido ({importMode === 'inventory' ? 'Inventario' : 'Negativos'})
              </p>
              <p className="text-xs text-muted-foreground">
                {importMode === 'inventory' && "El archivo debe contener las columnas: Código, Producto, Stock Sistema, Stock Físico, Diferencia"}
                {importMode === 'negative_preview' && "El archivo debe contener las columnas: Codebar (C), Producto (D), Cantidad (E), Precio (K)"}
                {importMode === 'collaborative_inventory' && "Se requiere cargar dos archivos con el formato de Inventario estándar."}
              </p>
            </div>
          </div>

          <Button
            onClick={importMode === 'collaborative_inventory' ? handleAnalyzeMerge : handleAnalyze}
            disabled={
              (importMode === 'collaborative_inventory' && (!filePartial || !fileComplete)) ||
              (importMode !== 'collaborative_inventory' && !file) ||
              analyzing
            }
            className="w-full"
            size="lg"
          >
            {analyzing ? "Analizando..." : "Analizar Archivo"}
          </Button>
        </div>
      </Card>

      {importMode === 'negative_preview' && negativeResults && (
        <motion.div
          ref={resultsRef}
          className="space-y-8"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Total Productos</p>
                  <h3 className="text-2xl font-bold text-foreground">{negativeResults.totalProducts}</h3>
                </div>
                <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Target className="w-6 h-6 text-primary" />
                </div>
              </div>
            </Card>

            <Card className="p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Items Negativos</p>
                  <h3 className="text-2xl font-bold text-destructive">
                    {negativeResults.items.filter(i => i.quantity < 0).length}
                  </h3>
                </div>
                <div className="h-12 w-12 bg-destructive/10 rounded-xl flex items-center justify-center">
                  <TrendingDown className="w-6 h-6 text-destructive" />
                </div>
              </div>
            </Card>

            <Card className="p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Items Positivos</p>
                  <h3 className="text-2xl font-bold text-success">
                    {negativeResults.items.filter(i => i.quantity > 0).length}
                  </h3>
                </div>
                <div className="h-12 w-12 bg-success/10 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-success" />
                </div>
              </div>
            </Card>

            <Card className="p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Total Unidades Negativas</p>
                  <h3 className="text-2xl font-bold text-destructive">
                    {negativeResults.items
                      .filter(i => i.quantity < 0)
                      .reduce((sum, i) => sum + Math.abs(i.quantity), 0)
                      .toLocaleString()}
                  </h3>
                </div>
                <div className="h-12 w-12 bg-destructive/10 rounded-xl flex items-center justify-center">
                  <Calculator className="w-6 h-6 text-destructive" />
                </div>
              </div>
            </Card>

            <Card className="p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Valor Items Negativos</p>
                  <h3 className="text-2xl font-bold text-destructive">
                    <CounterAnimation
                      value={negativeResults.items
                        .filter(i => i.quantity < 0)
                        .reduce((sum, i) => sum + Math.abs(i.totalValue), 0)
                      }
                      prefix="$"
                    />
                  </h3>
                </div>
                <div className="h-12 w-12 bg-destructive/10 rounded-xl flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-destructive" />
                </div>
              </div>
            </Card>
            <Card className="p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Valor Total</p>
                  <h3 className="text-2xl font-bold text-foreground">
                    <CounterAnimation value={negativeResults.totalValue} prefix="$" />
                  </h3>
                </div>
                <div className="h-12 w-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </Card>
          </div>

          {/* Middle Section - Controls & Search */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 py-4 sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b">
            <div className="flex items-center gap-2">
              <div className="bg-destructive/10 px-4 py-2 rounded-xl">
                <p className="text-sm font-semibold text-destructive">
                  Mostrando Faltantes ({negativeResults.items.filter(i => i.quantity < 0).length})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar producto, EAN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 bg-muted/30 border-muted-foreground/20 rounded-xl focus-visible:ring-primary"
                />
              </div>
            </div>
          </div>

          <Card className="border-muted/40 shadow-sm overflow-hidden bg-card">
            {/* Headers with Sorting */}
            <div className="grid grid-cols-12 gap-4 p-4 border-b bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
              <div className="col-span-6 md:col-span-4 pl-2">Producto</div>
              <div className="col-span-2 hidden md:block text-right">Precio</div>
              <div
                className="col-span-3 md:col-span-3 text-center flex items-center justify-center cursor-pointer hover:text-foreground transition-colors group"
                onClick={() => setSortConfig({
                  field: 'quantity',
                  direction: sortConfig.field === 'quantity' && sortConfig.direction === 'desc' ? 'asc' : 'desc'
                })}
              >
                Cantidad
                <div className="ml-1 opacity-50 group-hover:opacity-100">
                  {sortConfig.field === 'quantity' && (
                    sortConfig.direction === 'desc' ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />
                  )}
                  {sortConfig.field !== 'quantity' && <ArrowLeftRight className="w-3 h-3 rotate-90 opacity-20" />}
                </div>
              </div>
              <div
                className="col-span-3 md:col-span-3 text-right cursor-pointer hover:text-foreground transition-colors flex items-center justify-end pr-2 group"
                onClick={() => setSortConfig({
                  field: 'value',
                  direction: sortConfig.field === 'value' && sortConfig.direction === 'desc' ? 'asc' : 'desc'
                })}
              >
                Total ($)
                <div className="ml-1 opacity-50 group-hover:opacity-100">
                  {sortConfig.field === 'value' && (
                    sortConfig.direction === 'desc' ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />
                  )}
                  {sortConfig.field !== 'value' && <ArrowLeftRight className="w-3 h-3 rotate-90 opacity-20" />}
                </div>
              </div>
            </div>

            <div className="divide-y divide-border/40 max-h-[600px] overflow-y-auto">
              {negativeResults.items
                .filter(item => {
                  if (negativeFilter === 'negative' && item.quantity >= 0) return false;
                  if (negativeFilter === 'positive' && item.quantity <= 0) return false;

                  if (searchQuery) {
                    const q = searchQuery.toLowerCase();
                    return item.name.toLowerCase().includes(q) || item.codebar.toLowerCase().includes(q);
                  }
                  return true;
                })
                .sort((a, b) => {
                  const valA = sortConfig.field === 'value' ? a.totalValue : a.quantity;
                  const valB = sortConfig.field === 'value' ? b.totalValue : b.quantity;

                  if (sortConfig.direction === 'desc') {
                    return valB - valA;
                  } else {
                    return valA - valB;
                  }
                })
                .map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/10 transition-colors group">
                    {/* Product Info */}
                    <div className="col-span-6 md:col-span-4 flex items-center gap-3 pl-2 min-w-0">
                      <div className={cn("p-2 rounded-lg shrink-0", item.quantity < 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success')}>
                        {item.quantity < 0 ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0 flex flex-col justify-center">
                        <ProductImageHover ean={item.codebar} name={item.name}>
                          <p className="font-semibold text-sm text-foreground truncate" title={item.name}>{item.name}</p>
                        </ProductImageHover>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px] h-5 font-mono text-muted-foreground border-border/60 font-normal hidden sm:inline-flex">
                            {item.codebar}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground sm:hidden">{item.codebar}</span>
                        </div>
                      </div>
                    </div>

                    {/* Unit Price */}
                    <div className="col-span-2 hidden md:block text-right self-center">
                      <p className="text-sm font-medium">${item.price.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">Costo Unit.</p>
                    </div>

                    {/* Quantity (Pill Style) */}
                    <div className="col-span-3 md:col-span-3 flex justify-center self-center">
                      <div className={cn(
                        "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold w-20 justify-center",
                        item.quantity < 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
                      )}>
                        {item.quantity < 0 ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                        {item.quantity}
                      </div>
                    </div>

                    {/* Total Value */}
                    <div className="col-span-3 md:col-span-3 text-right pr-2 self-center">
                      <p className={cn(
                        "font-bold text-sm",
                        item.quantity < 0 ? "text-destructive" : "text-success"
                      )}>
                        ${item.totalValue.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        </motion.div>
      )}

      {(importMode === 'inventory' || importMode === 'collaborative_inventory') && results && (
        <motion.div
          ref={resultsRef}
          className="space-y-8"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {/* Collaborative Tabs */}
          {importMode === 'collaborative_inventory' && collaborativeResults && (
            <div className="flex justify-center">
              <div className="inline-flex bg-muted/50 p-1 rounded-xl">
                <button
                  onClick={() => {
                    setCollaborativeTab('partial');
                    setResults(collaborativeResults.partial);
                  }}
                  className={cn(
                    "px-6 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    collaborativeTab === 'partial'
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                  )}
                >
                  Nuestro Conteo
                </button>
                <button
                  onClick={() => {
                    setCollaborativeTab('branch');
                    setResults(collaborativeResults.branch);
                  }}
                  className={cn(
                    "px-6 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    collaborativeTab === 'branch'
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                  )}
                >
                  Conteo Sucursal
                </button>
                <button
                  onClick={() => {
                    setCollaborativeTab('general');
                    setResults(collaborativeResults.general);
                  }}
                  className={cn(
                    "px-6 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    collaborativeTab === 'general'
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                  )}
                >
                  Stock General
                </button>
              </div>
            </div>
          )}

          {/* 1. Top Section - Dashboard Summary Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Card 1: Balance & Financials */}
            <Card className="p-6 md:p-8 shadow-md border-muted/60 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-5">
                <Wallet className="w-32 h-32" />
              </div>

              <div className="relative z-10 space-y-8">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">
                        {showDiscrepancy ? "Total Discrepancia" : "Balance de Inventario"}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-muted/50 rounded-full"
                      onClick={() => setShowDiscrepancy(!showDiscrepancy)}
                      title="Cambiar vista"
                    >
                      <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl md:text-5xl font-bold tracking-tight text-foreground transition-all duration-300">
                      <CounterAnimation
                        value={showDiscrepancy
                          ? (results.totalShortageValue + results.totalSurplusValue)
                          : Math.abs(results.netDiscrepancyValue)
                        }
                        prefix="$"
                      />
                    </span>
                    {!showDiscrepancy && (
                      <span className={`text-xl font-bold ${results.netDiscrepancyValue >= 0 ? "text-success" : "text-destructive"}`}>
                        {results.netDiscrepancyValue >= 0 ? "(+)" : "(-)"}
                      </span>
                    )}
                  </div>
                  {showDiscrepancy && (
                    <p className="text-xs text-muted-foreground mt-1">Suma absoluta de todas las diferencias</p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-8">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Total Faltante</p>
                    <p className="text-xl font-bold text-destructive">
                      <CounterAnimation value={results.totalShortageValue} prefix="$" />
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Total Sobrante</p>
                    <p className="text-xl font-bold text-success">
                      <CounterAnimation value={results.totalSurplusValue} prefix="$" />
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Precisión</p>
                    <p className="text-xl font-bold text-primary">
                      <CounterAnimation value={results.inventoryAccuracy} decimals={1} suffix="%" />
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 pt-4 border-t border-border/40">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Valor Faltante (Unidades)</p>
                    <p className="font-semibold text-foreground">
                      <CounterAnimation value={results.totalShortageUnits} /> <span className="text-destructive font-bold">(-)</span>
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Valor Sobrante (Unidades)</p>
                    <p className="font-semibold text-foreground">
                      <CounterAnimation value={results.totalSurplusUnits} /> <span className="text-success font-bold">(+)</span>
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Card 2: Process Status - Mimicking "Membership Tier" */}
            <Card className="p-6 md:p-8 shadow-md border-none bg-primary text-primary-foreground relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Package className="w-40 h-40 transform rotate-12 translate-x-10 -translate-y-10" />
              </div>

              <div className="relative z-10 flex flex-col h-full justify-between space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-2 opacity-90">
                      <span className="text-sm font-semibold tracking-wide uppercase">Estado del Proceso</span>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="text-4xl md:text-5xl font-bold tracking-tight">
                        Finalizado
                      </span>
                      <div className="bg-white/20 p-1.5 rounded-full backdrop-blur-sm">
                        <CheckCircle className="w-5 h-5" />
                      </div>
                    </div>
                  </div>


                </div>

                <div className="grid grid-cols-2 gap-4 md:gap-6">
                  <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-md border border-white/10">
                    <div className="flex items-center gap-3 mb-2">
                      <Target className="w-8 h-8 opacity-80" />
                      <span className="text-2xl font-bold">{results.totalProducts}</span>
                    </div>
                    <p className="text-xs font-medium opacity-70 uppercase tracking-wider">Total Productos</p>
                  </div>

                  <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-md border border-white/10">
                    <div className="flex items-center gap-3 mb-2">
                      <ListFilter className="w-8 h-8 opacity-80" />
                      <span className="text-2xl font-bold">{results.totalScannedUnits}</span>
                    </div>
                    <p className="text-xs font-medium opacity-70 uppercase tracking-wider">Unidades Escaneadas</p>
                  </div>

                  {/* New Row of Boxes */}
                  <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-md border border-white/10">
                    <div className="flex items-center gap-3 mb-2">
                      <Calculator className="w-8 h-8 opacity-80" />
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold">{results.netDiscrepancyUnits > 0 ? '+' : ''}{results.netDiscrepancyUnits}</span>
                      </div>
                    </div>
                    <p className="text-xs font-medium opacity-70 uppercase tracking-wider">Unidades Netas (Ajuste)</p>
                  </div>

                  <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-md border border-white/10">
                    <div className="flex items-center gap-3 mb-2">
                      <CheckCircle className="w-8 h-8 opacity-80" />
                      <span className="text-2xl font-bold">{results.totalProductsNoDifference}</span>
                    </div>
                    <p className="text-xs font-medium opacity-70 uppercase tracking-wider">Productos sin Diferencia</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* 2. Middle Section - Controls & Tabs */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 py-4 sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b">
            <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
              <Button
                variant={activeTab === 'all' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('all')}
                className="rounded-lg text-xs font-medium h-9 px-4"
              >
                Todos
              </Button>
              <Button
                variant={activeTab === 'shortage' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('shortage')}
                className="rounded-lg text-xs font-medium h-9 px-4 hover:text-destructive hover:bg-destructive/10 data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground"
              >
                Faltantes ({results.allShortages.length})
              </Button>
              <Button
                variant={activeTab === 'surplus' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('surplus')}
                className="rounded-lg text-xs font-medium h-9 px-4 hover:text-success hover:bg-success/10"
              >
                Sobrantes ({results.allSurpluses.length})
              </Button>
              <Button
                variant={activeTab === 'zero_stock' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('zero_stock')}
                className="rounded-lg text-xs font-medium h-9 px-4 hover:text-blue-500 hover:bg-blue-500/10 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                Stock 0 ({results.allSurpluses.filter(p => p.systemStock === 0).length})
              </Button>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar producto, EAN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 bg-muted/30 border-muted-foreground/20 rounded-xl focus-visible:ring-primary"
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-muted-foreground/20">
                    <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setSortConfig({ field: 'quantity', direction: 'desc' })}>
                    <div className="flex items-center justify-between w-full">
                      <span>Mayor Cantidad (+)</span>
                      {sortConfig.field === 'quantity' && sortConfig.direction === 'desc' && <Check className="w-4 h-4" />}
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortConfig({ field: 'quantity', direction: 'asc' })}>
                    <div className="flex items-center justify-between w-full">
                      <span>Mayor Cantidad (-)</span>
                      {sortConfig.field === 'quantity' && sortConfig.direction === 'asc' && <Check className="w-4 h-4" />}
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortConfig({ field: 'value', direction: 'desc' })}>
                    <div className="flex items-center justify-between w-full">
                      <span>Mayor Importe (+)</span>
                      {sortConfig.field === 'value' && sortConfig.direction === 'desc' && <Check className="w-4 h-4" />}
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortConfig({ field: 'value', direction: 'asc' })}>
                    <div className="flex items-center justify-between w-full">
                      <span>Mayor Importe (-)</span>
                      {sortConfig.field === 'value' && sortConfig.direction === 'asc' && <Check className="w-4 h-4" />}
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* 3. Bottom Section - Data List */}
          <Card className="border-muted/40 shadow-sm overflow-hidden bg-card">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 p-4 border-b bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <div className="col-span-5 md:col-span-4 pl-2">Producto</div>
              <div className="col-span-2 text-right hidden md:block">Precio</div>
              <div className="col-span-3 md:col-span-2 text-center">Diferencia</div>
              <div className="col-span-2 text-center hidden sm:block">Físico / Sistema</div>
              <div className="col-span-2 md:col-span-2 text-right pr-2">Total ($)</div>
            </div>

            {/* List Body */}
            <div className="h-[600px] w-full bg-card">
              {filteredProducts.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>No se encontraron productos</p>
                </div>
              ) : (
                <AutoSizer>
                  {({ height, width }) => (
                    <List
                      height={height}
                      itemCount={filteredProducts.length}
                      itemSize={80}
                      width={width}
                      itemData={{
                        items: filteredProducts,
                        editingRow,
                        handleStartEditing,
                        handleStopEditing,
                        handleQuantityChange
                      }}
                    >
                      {Row}
                    </List>
                  )}
                </AutoSizer>
              )}
            </div>

            return (
            // ... inside the return statement ...
            /* List Body */
            <div className="h-[600px] w-full bg-card">
              {filteredProducts.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>No se encontraron productos</p>
                </div>
              ) : (
                <AutoSizer>
                  {({ height, width }) => (
                    <List
                      height={height}
                      itemCount={filteredProducts.length}
                      itemSize={80}
                      width={width}
                      itemData={{
                        items: filteredProducts,
                        editingRow,
                        handleStartEditing,
                        handleStopEditing,
                        handleQuantityChange
                      }}
                    >
                      {Row}
                    </List>
                  )}
                </AutoSizer>
              )}
            </div>

            {/* Footer / Pagination Mockup */}
            <div className="p-4 border-t bg-muted/20 flex justify-between items-center text-xs text-muted-foreground z-10 relative">
              <span>Mostrando {filteredProducts.length} registros (Virtualizado ⚡)</span>
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
      )
      }

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
    </motion.div >
  );
}
