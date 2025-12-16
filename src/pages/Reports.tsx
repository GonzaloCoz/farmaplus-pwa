import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Search, Calendar, Layers, Eye, ArrowLeft, Download, Trash2, MapPin, Image as ImageIcon, CheckCircle2, User } from "lucide-react";
import { notify } from "@/lib/notifications";
import { useNavigate, Link } from "react-router-dom";
import {
  getAllSessions,
  getSessionItems,
  PreCountSession,
  PreCountItem
} from "@/services/preCountDB";
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
import { PageHeader } from "@/components/layout/PageHeader";

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
      const finishedSessions = allSessions.filter(s => s.endTime).sort((a, b) => b.startTime - a.startTime);
      setSessions(finishedSessions);
    } catch (error) {
      console.error("Error loading sessions:", error);
      notify.error("Error", "Error al cargar el historial de pre-conteos");
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
    session.sector.toLowerCase().includes(searchSessionTerm.toLowerCase())
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
      doc.text(`Pre-Conteo: ${session.sector}`, margin, margin + 5);
      doc.setFontSize(8);
      doc.text(`Fecha: ${new Date(session.startTime).toLocaleDateString()}`, pageWidth - margin - 30, margin + 5);

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
        let title = item.productName;
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
          // Use CODE128 to avoid automatic check digit calculation
          // EAN13 format adds an extra digit which causes scanner issues
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
          // Fallback for any barcode generation error
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

      const fileName = `PreConteo_${session.sector}_${new Date(session.startTime).toISOString().split('T')[0]}.pdf`;
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
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.branch.toLowerCase().includes(search.toLowerCase()) ||
        r.sector.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (branch) {
      filtered = filtered.filter(r => r.branch.toLowerCase().includes(branch.toLowerCase()));
    }

    if (sector) {
      filtered = filtered.filter(r => r.sector.toLowerCase().includes(sector.toLowerCase()));
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

  const handleExportExcel = (report: InventoryReport) => {
    // Logic from provided original file... (omitted for brevity, assume standard export)
    notify.info("Información", "Función de exportar excel...");
  };
  // --- Re-implementing handleExportExcel properly as it was truncated above by me logically ---
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
        doc.text(batch.expirationDate || '-', 80, y); // Should format if stored raw
        doc.text(batch.quantity.toString(), 150, y);
        y += 5;
      });

      y += 5; // Spacing between items
    });

    doc.save(`Vencimientos_${report.sector}.pdf`);
    notify.success("Operación exitosa", "PDF Generado");
  };

  return (
    <PageLayout>


      <div className="flex-1">

        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3 max-w-[600px] mb-6 mx-auto bg-muted/50 p-1 rounded-full">
              <TabsTrigger value="pre-count" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm">Pre-Conteos</TabsTrigger>
              <TabsTrigger value="vencimientos" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm">Vencimientos</TabsTrigger>
              <TabsTrigger value="audits" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm">Auditorías</TabsTrigger>
            </TabsList>

            {/* --- TAB: PRE-CONTEOS --- */}
            <TabsContent value="pre-count" className="flex-1 overflow-hidden flex flex-col data-[state=inactive]:hidden motion-safe:animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-4 flex justify-end">
                <div className="relative w-full max-w-xs">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por sector..."
                    value={searchSessionTerm}
                    onChange={(e) => setSearchSessionTerm(e.target.value)}
                    className="pl-9 bg-card"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-auto rounded-xl border bg-card shadow-sm">
                {loadingSessions ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
                    <p>Cargando historial...</p>
                  </div>
                ) : filteredSessions.length > 0 ? (
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead>Sector</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-right">Productos</TableHead>
                        <TableHead className="text-right">Unidades</TableHead>
                        <TableHead className="w-[100px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSessions.map((session) => (
                        <TableRow key={session.id} className="hover:bg-muted/50 transition-colors">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Layers className="w-4 h-4 text-primary" />
                              {session.sector}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-muted-foreground text-xs">
                              <Calendar className="w-3 h-3" />
                              {new Date(session.startTime).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {session.totalProducts}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {session.totalUnits}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(session)}
                              className="hover:text-primary"
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Ver
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center p-20 text-center text-muted-foreground opacity-50">
                    <FileText className="w-16 h-16 mb-4 stroke-1" />
                    <p>No hay conteos finalizados aún.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* --- TAB: VENCIMIENTOS (NEW) --- */}
            <TabsContent value="vencimientos" className="flex-1 overflow-hidden flex flex-col data-[state=inactive]:hidden motion-safe:animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex-1 overflow-auto">
                {expReports.length === 0 ? (
                  <Card className="p-12 text-center border-dashed bg-muted/20">
                    <CheckCircle2 className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                    <h3 className="text-lg font-medium">Sin controles finalizados</h3>
                    <p className="text-sm text-muted-foreground mt-1">Los reportes de control de vencimientos aparecerán aquí.</p>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-10">
                    {expReports.map(report => (
                      <Card key={report.id} className="p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-bold text-lg">{report.sector}</h3>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(report.date).toLocaleDateString()}
                              <span>•</span>
                              <User className="w-3 h-3" />
                              {report.responsible}
                            </div>
                          </div>
                          <Badge variant="secondary" className="font-mono">{report.stats.totalUnits} u.</Badge>
                        </div>

                        <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Productos</span>
                            <span className="font-medium">{report.stats.totalProducts}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Unidades</span>
                            <span className="font-medium">{report.stats.totalUnits}</span>
                          </div>
                        </div>

                        <div className="flex gap-2 mt-auto pt-2">
                          <Button className="flex-1" variant="outline" size="sm" onClick={() => {
                            setSelectedExpReport(report);
                            setExpDetailsOpen(true);
                          }}>
                            <Eye className="w-4 h-4 mr-2" />
                            Detalles
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => deleteExpReport(report.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* --- TAB: AUDITORÍAS --- */}
            <TabsContent value="audits" className="flex-1 overflow-hidden flex flex-col data-[state=inactive]:hidden motion-safe:animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar reporte..."
                    value={searchReportTerm}
                    onChange={(e) => handleSearchReport(e.target.value)}
                    className="pl-9 bg-card"
                  />
                </div>
                <Input
                  placeholder="Filtrar por sucursal..."
                  value={filterBranch}
                  onChange={(e) => handleFilterBranch(e.target.value)}
                  className="bg-card"
                />
                <Input
                  placeholder="Filtrar por sector..."
                  value={filterSector}
                  onChange={(e) => handleFilterSector(e.target.value)}
                  className="bg-card"
                />
              </div>

              <div className="flex-1 overflow-auto">
                {filteredReports.length === 0 ? (
                  <Card className="p-12 text-center border-dashed bg-muted/20">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                    <h3 className="text-lg font-medium text-foreground">
                      {reports.length === 0 ? "Sin reportes aún" : "Sin resultados"}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {reports.length === 0
                        ? "Los reportes de 'Importar Inventario' aparecerán aquí"
                        : "Intenta con otros filtros de búsqueda"}
                    </p>
                  </Card>
                ) : (
                  <div className="space-y-3 pb-10">
                    {filteredReports.map((report) => (
                      <Link to={`/reports/${report.id}`} key={report.id} className="block group">
                        <Card className="p-4 cursor-pointer hover:shadow-md transition-all border-l-4 border-l-primary/0 hover:border-l-primary">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{report.name}</h3>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /><span>{report.branch}</span></div>
                                <div className="flex items-center gap-2"><Layers className="h-4 w-4" /><span>{report.sector}</span></div>
                                <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /><span>{new Date(report.date).toLocaleDateString("es-ES")}</span></div>
                              </div>
                            </div>
                            <div className="flex gap-2" onClick={(e) => e.preventDefault()}>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleExportImage(report)}
                                className="hover:bg-primary hover:text-primary-foreground"
                                title="Exportar como Imagen"
                              >
                                <ImageIcon className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => doExportExcel(report)}
                                className="hover:bg-success hover:text-success-foreground"
                                title="Exportar Excel"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteReport(report.id)}
                                className="hover:bg-destructive hover:text-destructive-foreground"
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
            </TabsContent>
          </Tabs>
        </div>

        {/* Dialogo de Detalles (Pre-Conteo) */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Detalle del Pre-Conteo</DialogTitle>
              <DialogDescription>
                {selectedSession && (
                  <span>
                    Sector: <strong>{selectedSession.sector}</strong> -
                    Fecha: {new Date(selectedSession.startTime).toLocaleString()}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-auto min-h-[300px] border rounded-md">
              {loadingItems ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead>EAN</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessionItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs">{item.ean}</TableCell>
                        <TableCell className="text-sm">{item.productName}</TableCell>
                        <TableCell className="text-right font-bold">{item.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t mt-auto">
              <Button
                variant="outline"
                onClick={() => selectedSession && handleExportPDF(selectedSession, sessionItems)}
                disabled={loadingItems || sessionItems.length === 0}
              >
                <FileText className="w-4 h-4 mr-2" />
                Descargar PDF
              </Button>
              <Button onClick={() => setDetailsOpen(false)}>
                Cerrar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialogo Detalles Vencimientos */}
        <Dialog open={expDetailsOpen} onOpenChange={setExpDetailsOpen}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex justify-between items-center mr-6">
                <span>Reporte Vencimientos</span>
                <Badge variant="outline">{selectedExpReport?.sector}</Badge>
              </DialogTitle>
              <DialogDescription>
                <div>Fecha: {selectedExpReport && new Date(selectedExpReport.date).toLocaleString()}</div>
                <div>Responsable: {selectedExpReport?.responsible}</div>
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-auto border rounded-xl bg-card p-0">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead className="text-right">Cant.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedExpReport?.items.map((item: any) => (
                    item.batches.map((batch: any, idx: number) => (
                      <TableRow key={item.id + idx}>
                        <TableCell className="font-medium text-xs">
                          {idx === 0 && (
                            <div>
                              <div>{item.productName}</div>
                              <span className="text-muted-foreground text-[10px]">{item.ean}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{batch.batchNumber}</TableCell>
                        <TableCell className="font-mono text-xs">{batch.expirationDate}</TableCell>
                        <TableCell className="text-right font-bold">{batch.quantity}</TableCell>
                      </TableRow>
                    ))
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t mt-auto">
              <Button variant="outline" onClick={() => selectedExpReport && exportExpPDF(selectedExpReport)}>
                <FileText className="w-4 h-4 mr-2" />
                Descargar PDF
              </Button>
              <Button onClick={() => setExpDetailsOpen(false)}>Cerrar</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Hidden Template for Image Generation (Auditorías) */}
        <div className="fixed left-[-9999px] top-0">
          <ReportTemplate ref={reportTemplateRef} report={reportToExport} />
        </div>
      </div>
    </PageLayout>
  );
}