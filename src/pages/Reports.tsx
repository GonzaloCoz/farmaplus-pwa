import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Document as FileText, Magnifer as Search, Calendar, Layers, Eye, AltArrowLeft as ArrowLeft, Download, TrashBinMinimalistic as Trash2, MapPoint as MapPin, Gallery as ImageIcon, CheckCircle, User, ShieldCheck } from "@solar-icons/react";
import { notify } from "@/lib/notifications";
import { useNavigate, Link } from "react-router-dom";
import {
  getAllSessions,
  getSessionItems,
  PreCountSession,
  PreCountItem
} from "@/services/preCountDB";
import { Frame, FramePanel } from "@/components/ui/frame";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import { ReportTemplate } from "@/components/ReportTemplate";
import { Badge } from "@/components/ui/badge";
import { PageLayout } from "@/components/layout/PageLayout";
import { motion } from "framer-motion";
import { useUser } from "@/contexts/UserContext";

const AdminAudit = lazy(() => import("@/pages/AdminAudit"));

// Interface for Old Inventory Reports
interface InventoryReport {
  id: string;
  name: string;
  branch: string;
  sector: string;
  date: string;
  timestamp: string;
  results: any;
}

// Interface for Expiration Reports
interface ExpirationReport {
  id: string;
  sector: string;
  date: string;
  responsible: string;
  items: any[];
  stats: {
    totalProducts: number;
    totalUnits: number;
  };
}

export default function Reports() {
  const navigate = useNavigate();
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState("pre-count");

  // --- PRE-COUNT HISTORY STATE ---
  const [sessions, setSessions] = useState<PreCountSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [searchSessionTerm, setSearchSessionTerm] = useState("");
  const [selectedSession, setSelectedSession] = useState<PreCountSession | null>(null);
  const [sessionItems, setSessionItems] = useState<PreCountItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // --- INVENTORY REPORTS STATE ---
  const [reports, setReports] = useState<InventoryReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<InventoryReport[]>([]);
  const [searchReportTerm, setSearchReportTerm] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterSector, setFilterSector] = useState("");
  const reportTemplateRef = useRef<HTMLDivElement>(null);
  const [reportToExport, setReportToExport] = useState<InventoryReport | null>(null);

  // --- EXPIRATION REPORTS STATE ---
  const [expReports, setExpReports] = useState<ExpirationReport[]>([]);
  const [expDetailsOpen, setExpDetailsOpen] = useState(false);
  const [selectedExpReport, setSelectedExpReport] = useState<ExpirationReport | null>(null);

  useEffect(() => {
    loadSessions();
    loadInventoryReports();
    loadExpirationReports();
  }, []);

  // --- PRE-COUNT LOGIC ---
  const loadSessions = async () => {
    try {
      setLoadingSessions(true);
      const allSessions = await getAllSessions();
      const finishedSessions = allSessions.filter(s => s.end_time).sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
      setSessions(finishedSessions);
    } catch (error) {
      console.error("Error loading sessions:", error);
      notify.error("Error", "Error al cargar el historial de captura de datos");
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleViewDetails = async (session: PreCountSession) => {
    setSelectedSession(session);
    setDetailsOpen(true);
    setLoadingItems(true);
    try {
      const items = await getSessionItems(session);
      setSessionItems(items);
    } catch (error) {
      console.error("Error loading session items:", error);
      notify.error("Error", "Error al cargar los detalles");
    } finally {
      setLoadingItems(false);
    }
  };

  const filteredSessions = sessions.filter(session =>
    (session.sector || '').toLowerCase().includes(searchSessionTerm.toLowerCase())
  );

  const handleExportPDF = (session: PreCountSession, items: PreCountItem[]) => {
    if (items.length === 0) {
      notify.error("Error", 'No hay productos para exportar');
      return;
    }

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const cols = 3;
      const gap = 3;
      const cellWidth = (pageWidth - (margin * 2) - (gap * (cols - 1))) / cols;
      const cellHeight = 28;

      let x = margin;
      let y = margin + 15;

      doc.setFontSize(14);
      doc.text(`Colector de Datos: ${session.sector}`, margin, margin + 5);
      doc.setFontSize(8);
      doc.text(`Fecha: ${new Date(session.start_time).toLocaleDateString()}`, pageWidth - margin - 30, margin + 5);

      items.forEach((item, index) => {
        if (y + cellHeight > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }

        doc.setDrawColor(200);
        doc.setLineWidth(0.1);
        doc.roundedRect(x, y, cellWidth, cellHeight, 2, 2, 'S');

        const contentWidth = cellWidth - 4;
        const titleX = x + 2;
        const titleY = y + 5;

        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        let title = item.product_name;
        if (doc.getTextWidth(title) > contentWidth) {
          const maxChars = Math.floor(contentWidth / 2);
          title = title.substring(0, maxChars) + "...";
        }
        doc.text(title, titleX, titleY);

        const barcodeWidth = cellWidth * 0.65;
        const barcodeHeight = 15;
        const barcodeX = x + 2;
        const barcodeY = y + 8;

        const canvas = document.createElement('canvas');
        try {
          JsBarcode(canvas, item.ean, {
            format: "CODE128",
            displayValue: true,
            fontSize: 14,
            fontOptions: "bold",
            margin: 0,
            height: 40,
            width: 2,
            background: "#ffffff",
            lineColor: "#000000",
            textMargin: 0,
          });
          const barcodeData = canvas.toDataURL("image/png");
          doc.addImage(barcodeData, 'PNG', barcodeX, barcodeY, barcodeWidth, barcodeHeight);
        } catch (e) {
          doc.setFontSize(8);
          doc.text(item.ean, barcodeX, barcodeY + 10);
        }

        const qtyX = x + cellWidth - 2;
        const qtyY = y + cellHeight - 6;

        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.text(item.quantity.toString(), qtyX, qtyY, { align: "right" });

        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100);
        doc.text("CANT", qtyX, qtyY - 10, { align: "right" });
        doc.setTextColor(0);

        if ((index + 1) % cols === 0) {
          x = margin;
          y += cellHeight + gap;
        } else {
          x += cellWidth + gap;
        }
      });

      const fileName = `ColectorDatos_${session.sector}_${new Date(session.start_time).toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      notify.success("Operación exitosa", 'PDF generado correctamente');

    } catch (error) {
      console.error('Error generating PDF:', error);
      notify.error("Error", 'Error al generar el PDF');
    }
  };

  // --- INVENTORY REPORTS LOGIC ---
  const loadInventoryReports = () => {
    const storedReports = JSON.parse(localStorage.getItem("inventory-reports") || "[]");
    setReports(storedReports);
    applyReportFilters(storedReports, searchReportTerm, filterBranch, filterSector);
  };

  const applyReportFilters = (reportsToFilter: InventoryReport[], search: string, branch: string, sector: string) => {
    let filtered = reportsToFilter;

    if (search) {
      filtered = filtered.filter(r =>
        (r.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.branch || '').toLowerCase().includes(search.toLowerCase()) ||
        (r.sector || '').toLowerCase().includes(search.toLowerCase())
      );
    }

    if (branch) {
      filtered = filtered.filter(r => (r.branch || '').toLowerCase().includes(branch.toLowerCase()));
    }

    if (sector) {
      filtered = filtered.filter(r => (r.sector || '').toLowerCase().includes(sector.toLowerCase()));
    }

    setFilteredReports(filtered.reverse());
  };

  const handleSearchReport = (value: string) => {
    setSearchReportTerm(value);
    applyReportFilters(reports, value, filterBranch, filterSector);
  };

  const handleFilterBranch = (value: string) => {
    setFilterBranch(value);
    applyReportFilters(reports, searchReportTerm, value, filterSector);
  };

  const handleFilterSector = (value: string) => {
    setFilterSector(value);
    applyReportFilters(reports, searchReportTerm, filterBranch, value);
  };

  const handleDeleteReport = (id: string) => {
    const updated = reports.filter(r => r.id !== id);
    setReports(updated);
    localStorage.setItem("inventory-reports", JSON.stringify(updated));
    applyReportFilters(updated, searchReportTerm, filterBranch, filterSector);
    notify.success("Operación exitosa", "Reporte eliminado");
  };

  const doExportExcel = (report: InventoryReport) => {
    try {
      const formatForSheet = (data: any[]) => data.map(item => ({
        'Código de Barras': item.codebar,
        'Producto': item.name,
        'Diferencia (Unidades)': item.diffQty,
        'Valor Diferencia ($)': item.diffValue,
        'Stock Sistema': item.systemStock,
        'Conteo Físico': item.physicalCount,
        'Costo Unitario ($)': item.cost,
        'Precio Venta ($)': item.salePrice,
      }));

      const shortagesByValue = report.results.allShortages
        .sort((a: any, b: any) => a.diffValue - b.diffValue)
        .slice(0, 15);
      const surplusesByValue = report.results.allSurpluses
        .sort((a: any, b: any) => b.diffValue - a.diffValue)
        .slice(0, 15);

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(formatForSheet(shortagesByValue)),
        "Faltantes"
      );
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(formatForSheet(surplusesByValue)),
        "Sobrantes"
      );

      XLSX.writeFile(workbook, `Reporte_${report.name}_${report.date}.xlsx`);
      notify.success("Operación exitosa", "Reporte exportado correctamente");
    } catch (error) {
      notify.error("Error", "Error al exportar el reporte");
    }
  };


  const handleExportImage = async (report: InventoryReport) => {
    setReportToExport(report);
    setTimeout(async () => {
      if (reportTemplateRef.current) {
        try {
          const canvas = await html2canvas(reportTemplateRef.current, {
            scale: 2,
            backgroundColor: "#ffffff",
          });

          const link = document.createElement("a");
          link.download = `Reporte_${report.name}_${report.date}.png`;
          link.href = canvas.toDataURL("image/png");
          link.click();

          notify.success("Operación exitosa", "Imagen generada correctamente");
        } catch (error) {
          console.error("Error generating image:", error);
          notify.error("Error", "Error al generar la imagen");
        } finally {
          setReportToExport(null);
        }
      }
    }, 100);
  };

  // --- EXPIRATION REPORTS LOGIC ---
  const loadExpirationReports = () => {
    const stored = JSON.parse(localStorage.getItem('expiration-reports') || '[]');
    setExpReports(stored);
  };

  const deleteExpReport = (id: string) => {
    const updated = expReports.filter(r => r.id !== id);
    setExpReports(updated);
    localStorage.setItem('expiration-reports', JSON.stringify(updated));
    notify.success("Operación exitosa", "Reporte eliminado");
  };

  const exportExpPDF = (report: ExpirationReport) => {
    const doc = new jsPDF();
    let y = 20;
    doc.setFontSize(16);
    doc.text(`Control de Vencimientos`, 10, y);
    doc.setFontSize(10);
    doc.text(`Sector: ${report.sector}`, 10, y + 6);
    doc.text(`Responsable: ${report.responsible}`, 10, y + 12);
    doc.text(`Fecha: ${new Date(report.date).toLocaleDateString()} ${new Date(report.date).toLocaleTimeString()}`, 10, y + 18);

    y += 25;

    report.items.forEach((item: any) => {
      if (y > 270) { doc.addPage(); y = 20; }

      doc.setFont("helvetica", "bold");
      doc.text(`${item.productName} (EAN: ${item.ean})`, 10, y);
      doc.text(`Total: ${item.totalQuantity}`, 180, y, { align: 'right' });
      y += 6;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      // Headers
      doc.text("Lote", 15, y);
      doc.text("Vencimiento", 80, y);
      doc.text("Cantidad", 150, y);
      y += 5;

      item.batches.forEach((batch: any) => {
        doc.text(batch.batchNumber, 15, y);
        doc.text(batch.expirationDate || '-', 80, y);
        doc.text(batch.quantity.toString(), 150, y);
        y += 5;
      });

      y += 5; // Spacing between items
    });

    doc.save(`Vencimientos_${report.sector}.pdf`);
    notify.success("Operación exitosa", "PDF Generado");
  };

  return (
    <PageLayout className="flex flex-col h-full overflow-hidden pt-6">
      <div className="flex-1 flex flex-col min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-center mb-8">
            <TabsList className="bg-muted/30 p-1 rounded-xl border border-border/50 backdrop-blur-sm shadow-inner overflow-hidden">
              <TabsTrigger
                value="pre-count"
                className="rounded-lg px-8 py-2 data-[active]:bg-background data-[active]:shadow-md data-[active]:text-primary transition-all duration-300 font-medium"
              >
                Colector
              </TabsTrigger>
              <TabsTrigger
                value="vencimientos"
                className="rounded-lg px-8 py-2 data-[active]:bg-background data-[active]:shadow-md data-[active]:text-primary transition-all duration-300 font-medium"
              >
                Vencimientos
              </TabsTrigger>
              <TabsTrigger
                value="audits"
                className="rounded-lg px-8 py-2 data-[active]:bg-background data-[active]:shadow-md data-[active]:text-primary transition-all duration-300 font-medium"
              >
                Auditorías
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger
                  value="system-audit"
                  className="rounded-lg px-8 py-2 data-[active]:bg-background data-[active]:shadow-md data-[active]:text-primary transition-all duration-300 font-medium"
                >
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Log de Auditoría
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden px-1">
            {/* --- TAB: COLECTOR --- */}
            <TabsContent value="pre-count" className="h-full m-0 data-[hidden]:hidden outline-none">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="h-full flex flex-col min-h-0"
              >
                <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-1">
                  <h3 className="text-lg font-semibold text-foreground/80">Sesiones Finalizadas</h3>
                  <div className="relative w-full sm:max-w-xs group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      placeholder="Buscar por sector..."
                      value={searchSessionTerm}
                      onChange={(e) => setSearchSessionTerm(e.target.value)}
                      className="pl-10 bg-muted/20 border-border/50 focus:bg-background transition-all rounded-xl"
                    />
                  </div>
                </div>

                <Frame>
                  <FramePanel className="p-0 overflow-hidden">
                    <Table>
                      <TableHeader className="bg-transparent">
                        <TableRow className="hover:bg-transparent border-none">
                          <TableHead className="pl-6 font-semibold py-4">Sector</TableHead>
                          <TableHead className="font-semibold">Fecha</TableHead>
                          <TableHead className="text-right font-semibold">Productos</TableHead>
                          <TableHead className="text-right font-semibold">Unidades</TableHead>
                          <TableHead className="w-[100px] pr-6 font-semibold"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="bg-background rounded-l-xl rounded-r-xl overflow-hidden shadow-xs/5">
                        {filteredSessions.map((session) => (
                          <TableRow key={session.id} className="group/row border-t border-border/40 first:border-none">
                            <TableCell className="font-semibold text-foreground/90 pl-6 py-4">
                              <div className="flex items-center gap-2">
                                <Layers className="w-4 h-4 text-primary opacity-70 group-hover/row:opacity-100 transition-opacity" />
                                {session.sector}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 text-muted-foreground/70 text-xs">
                                <Calendar className="w-3 h-3" />
                                {new Date(session.start_time).toLocaleDateString()}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm font-semibold text-foreground/80">
                              {session.totalProducts}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm font-semibold text-foreground/80">
                              {session.totalUnits}
                            </TableCell>
                            <TableCell className="pr-6">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewDetails(session)}
                                className="hover:text-primary rounded-lg h-8"
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                Ver
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </FramePanel>
                </Frame>
              </motion.div>
            </TabsContent>

            {/* --- TAB: VENCIMIENTOS --- */}
            <TabsContent value="vencimientos" className="h-full m-0 data-[hidden]:hidden outline-none">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="h-full flex flex-col min-h-0"
              >
                <div className="flex-1 overflow-auto">
                  {expReports.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-20 text-center">
                      <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mb-6">
                        <CheckCircle className="w-10 h-10 text-muted-foreground/40 stroke-1" />
                      </div>
                      <h3 className="text-xl font-semibold text-foreground/70 mb-2">Sin controles finalizados</h3>
                      <p className="text-muted-foreground max-w-[250px]">Los reportes de control de vencimientos aparecerán aquí.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10">
                      {expReports.map(report => (
                        <Card key={report.id} className="p-6 flex flex-col gap-4 hover:shadow-lg transition-all border-border/50 bg-card/50 backdrop-blur-sm rounded-lg group/card overflow-hidden relative">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 transition-transform group-hover/card:scale-150" />
                          <div className="flex justify-between items-start relative z-10">
                            <div>
                              <h3 className="font-bold text-xl text-foreground/90">{report.sector}</h3>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                                <Calendar className="w-3.5 h-3.5" />
                                {new Date(report.date).toLocaleDateString()}
                                <span className="opacity-30">•</span>
                                <User className="w-3.5 h-3.5" />
                                {report.responsible}
                              </div>
                            </div>
                            <Badge variant="secondary" className="px-3 py-1 rounded-lg bg-primary/10 text-primary border-none font-mono text-sm">
                              {report.stats.totalUnits} u.
                            </Badge>
                          </div>

                          <div className="bg-muted/30 rounded-xl p-4 text-sm space-y-2 relative z-10">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Productos</span>
                              <span className="font-bold">{report.stats.totalProducts}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Unidades Totales</span>
                              <span className="font-bold">{report.stats.totalUnits}</span>
                            </div>
                          </div>

                          <div className="flex gap-2 mt-auto pt-4 relative z-10">
                            <Button className="flex-1 rounded-xl shadow-sm group/btn" variant="outline" size="sm" onClick={() => {
                              setSelectedExpReport(report);
                              setExpDetailsOpen(true);
                            }}>
                              <Eye className="w-4 h-4 mr-2 transition-transform group-hover/btn:scale-110" />
                              Ver Detalles
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-xl" onClick={() => deleteExpReport(report.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </TabsContent>

            {/* --- TAB: AUDITORÍAS --- */}
            <TabsContent value="audits" className="h-full m-0 data-[hidden]:hidden outline-none">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="h-full flex flex-col min-h-0"
              >
                <div className="flex flex-col gap-6 mb-8 px-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-foreground/80">Auditorías de Inventario</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative group">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input
                        placeholder="Buscar reporte..."
                        value={searchReportTerm}
                        onChange={(e) => handleSearchReport(e.target.value)}
                        className="pl-10 bg-muted/20 border-border/50 focus:bg-background transition-all rounded-xl"
                      />
                    </div>
                    <div className="relative group">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input
                        placeholder="Filtrar por sucursal..."
                        value={filterBranch}
                        onChange={(e) => handleFilterBranch(e.target.value)}
                        className="pl-10 bg-muted/20 border-border/50 focus:bg-background transition-all rounded-xl"
                      />
                    </div>
                    <div className="relative group">
                      <Layers className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input
                        placeholder="Filtrar por sector..."
                        value={filterSector}
                        onChange={(e) => handleFilterSector(e.target.value)}
                        className="pl-10 bg-muted/20 border-border/50 focus:bg-background transition-all rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-auto px-1">
                  {filteredReports.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-20 text-center">
                      <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mb-6">
                        <FileText className="w-10 h-10 text-muted-foreground/40 stroke-1" />
                      </div>
                      <h3 className="text-xl font-semibold text-foreground/70 mb-2">
                        {reports.length === 0 ? "Sin reportes aún" : "Sin resultados"}
                      </h3>
                      <p className="text-muted-foreground max-w-[300px]">
                        {reports.length === 0
                          ? "Los reportes de 'Importar Inventario' aparecerán aquí una vez que se procesen."
                          : "No encontramos reportes que coincidan con los filtros aplicados."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 pb-10">
                      {filteredReports.map((report) => (
                        <Link to={`/reports/${report.id}`} key={report.id} className="block group">
                          <Card className="p-5 cursor-pointer hover:shadow-md transition-all border-l-4 border-l-transparent hover:border-l-primary bg-card/50 backdrop-blur-sm rounded-lg border border-border/50 overflow-hidden relative">
                            <div className="flex items-start justify-between relative z-10">
                              <div className="flex-1">
                                <h3 className="font-bold text-lg text-foreground/90 group-hover:text-primary transition-colors">{report.name}</h3>
                                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-3 text-sm text-muted-foreground">
                                  <div className="flex items-center gap-2 bg-muted/50 px-3 py-1 rounded-full"><MapPin className="h-3.5 w-3.5" /><span>{report.branch}</span></div>
                                  <div className="flex items-center gap-2 bg-muted/50 px-3 py-1 rounded-full"><Layers className="h-3.5 w-3.5" /><span>{report.sector}</span></div>
                                  <div className="flex items-center gap-2 bg-muted/50 px-3 py-1 rounded-full"><Calendar className="h-3.5 w-3.5" /><span>{new Date(report.date).toLocaleDateString("es-ES")}</span></div>
                                </div>
                              </div>
                              <div className="flex gap-2" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  onClick={() => handleExportImage(report)}
                                  className="h-9 w-9 rounded-xl hover:bg-primary hover:text-primary-foreground border-border/50"
                                  title="Exportar como Imagen"
                                >
                                  <ImageIcon className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  onClick={() => doExportExcel(report)}
                                  className="h-9 w-9 rounded-xl hover:bg-success hover:text-success-foreground border-border/50 text-success"
                                  title="Exportar Excel"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  onClick={() => handleDeleteReport(report.id)}
                                  className="h-9 w-9 rounded-xl hover:bg-destructive hover:text-destructive-foreground border-border/50 text-destructive/70"
                                  title="Eliminar"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </TabsContent>

            {/* --- TAB: SYSTEM AUDIT --- */}
            {isAdmin && (
              <TabsContent value="system-audit" className="flex-1 m-0 data-[hidden]:hidden outline-none overflow-y-auto">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="h-full flex flex-col min-h-0 px-1"
                >
                  <Suspense fallback={
                    <div className="flex flex-col items-center justify-center p-20 text-center">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4" />
                      <p className="text-muted-foreground animate-pulse">Cargando registros de auditoría...</p>
                    </div>
                  }>
                    <AdminAudit />
                  </Suspense>
                </motion.div>
              </TabsContent>
            )}
          </div>
        </Tabs>
      </div>

      {/* --- DIALOGS --- */}

      {/* Dialogo de Detalles (Colector) */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col rounded-xl overflow-hidden border-none shadow-md p-0">
          <div className="bg-muted/10 p-6 pb-4 border-b">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold tracking-tight">Detalle del Colector</DialogTitle>
              <DialogDescription className="text-base mt-2">
                {selectedSession && (
                  <div className="flex items-center gap-3 mt-1">
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 px-3 py-1 rounded-lg">Sector: {selectedSession.sector}</Badge>
                    <span className="text-muted-foreground/60">|</span>
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      {new Date(selectedSession.start_time).toLocaleString()}
                    </span>
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-auto bg-card/10">
            {loadingItems ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
                <p className="text-muted-foreground animate-pulse">Cargando productos...</p>
              </div>
            ) : (
              <div className="p-6 pt-0">
                <Frame>
                  <Table>
                    <TableHeader className="bg-transparent">
                      <TableRow className="hover:bg-transparent border-none">
                        <TableHead className="pl-6">EAN</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right pr-6">Cantidad</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="bg-background rounded-l-xl rounded-r-xl overflow-hidden shadow-xs/5">
                      {sessionItems.map((item) => (
                        <TableRow key={item.id} className="border-t border-border/40 first:border-none">
                          <TableCell className="font-mono text-xs font-semibold text-muted-foreground/80 pl-6">{item.ean}</TableCell>
                          <TableCell className="text-sm font-medium text-foreground/90">{item.product_name}</TableCell>
                          <TableCell className="text-right pr-6 font-bold text-lg tabular-nums">{item.quantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Frame>
              </div>
            )}
          </div>

          <div className="p-6 border-t bg-muted/5 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => selectedSession && handleExportPDF(selectedSession, sessionItems)}
              disabled={loadingItems || sessionItems.length === 0}
              className="rounded-xl px-6 h-11 border-border/50"
            >
              <FileText className="w-4 h-4 mr-2" />
              Descargar PDF
            </Button>
            <Button onClick={() => setDetailsOpen(false)} className="rounded-xl px-8 h-11 shadow-md">
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialogo Detalles Vencimientos */}
      <Dialog open={expDetailsOpen} onOpenChange={setExpDetailsOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col rounded-xl overflow-hidden border-none shadow-md p-0">
          <div className="bg-muted/10 p-6 pb-4 border-b">
            <DialogHeader>
              <DialogTitle className="flex justify-between items-center mr-8">
                <span className="text-2xl font-bold tracking-tight">Reporte Vencimientos</span>
                <Badge className="bg-primary/10 text-primary border-none text-sm px-4 py-1 rounded-full uppercase tracking-wider">{selectedExpReport?.sector}</Badge>
              </DialogTitle>
              <DialogDescription className="text-base mt-2 space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  {selectedExpReport && new Date(selectedExpReport.date).toLocaleString()}
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <User className="w-4 h-4" />
                  Responsable: <span className="font-semibold text-foreground/80">{selectedExpReport?.responsible}</span>
                </div>
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-auto bg-card/10">
            <div className="p-6 pt-0">
              <Table>
                <TableHeader className="sticky top-0 bg-background/80 backdrop-blur-sm z-10">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="py-4">Producto / EAN</TableHead>
                    <TableHead className="py-4">Lote</TableHead>
                    <TableHead className="py-4">Vencimiento</TableHead>
                    <TableHead className="text-right py-4">Cantidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedExpReport?.items.map((item: any) => (
                    item.batches.map((batch: any, idx: number) => (
                      <TableRow key={item.id + idx}>
                        <TableCell className="py-4">
                          {idx === 0 ? (
                            <div className="space-y-0.5">
                              <div className="text-sm font-semibold">{item.productName}</div>
                              <div className="text-muted-foreground text-[10px] font-mono tracking-tighter">{item.ean}</div>
                            </div>
                          ) : (
                            <div className="w-8 h-[1px] bg-muted/20 ml-2" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs py-4 font-medium">{batch.batchNumber}</TableCell>
                        <TableCell className="font-mono text-xs py-4">
                          <Badge variant="outline" className="border-border/50 text-[10px] rounded-md font-mono">
                            {batch.expirationDate}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right py-4 font-bold text-lg">{batch.quantity}</TableCell>
                      </TableRow>
                    ))
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="p-6 border-t bg-muted/5 flex justify-end gap-3">
            <Button variant="outline" onClick={() => selectedExpReport && exportExpPDF(selectedExpReport)} className="rounded-xl px-6 h-11 border-border/50">
              <FileText className="w-4 h-4 mr-2" />
              Descargar PDF
            </Button>
            <Button onClick={() => setExpDetailsOpen(false)} className="rounded-xl px-8 h-11 shadow-md">Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden Template for Image Generation (Auditorías) */}
      <div className="fixed left-[-9999px] top-0 opacity-0 pointer-events-none">
        <ReportTemplate ref={reportTemplateRef} report={reportToExport} />
      </div>
    </PageLayout>
  );
}
