import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Search, Calendar, Layers, Eye, ArrowLeft, Download, Trash2, MapPin, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
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

  useEffect(() => {
    loadSessions();
    loadInventoryReports();
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
      toast.error("Error al cargar el historial de pre-conteos");
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
      toast.error("Error al cargar los detalles");
    } finally {
      setLoadingItems(false);
    }
  };

  const filteredSessions = sessions.filter(session =>
    session.sector.toLowerCase().includes(searchSessionTerm.toLowerCase())
  );

  const handleExportPDF = (session: PreCountSession, items: PreCountItem[]) => {
    if (items.length === 0) {
      toast.error('No hay productos para exportar');
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
          JsBarcode(canvas, item.ean, {
            format: "EAN13",
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
          } catch (err) {
            doc.setFontSize(8);
            doc.text(item.ean, barcodeX, barcodeY + 10);
          }
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
      toast.success('PDF generado correctamente');

    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Error al generar el PDF');
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
    toast.success("Reporte eliminado");
  };

  const handleExportExcel = (report: InventoryReport) => {
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
      toast.success("Reporte exportado correctamente");
    } catch (error) {
      toast.error("Error al exportar el reporte");
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

          toast.success("Imagen generada correctamente");
        } catch (error) {
          console.error("Error generating image:", error);
          toast.error("Error al generar la imagen");
        } finally {
          setReportToExport(null);
        }
      }
    }, 100);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 overflow-hidden p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-4">
            <TabsTrigger value="pre-count">Pre-Conteos</TabsTrigger>
            <TabsTrigger value="audits">Auditorías</TabsTrigger>
          </TabsList>

          {/* --- TAB: PRE-CONTEOS --- */}
          <TabsContent value="pre-count" className="flex-1 overflow-hidden flex flex-col data-[state=inactive]:hidden">
            <div className="mb-4">
              <div className="relative w-full max-w-xs sm:max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por sector..."
                  value={searchSessionTerm}
                  onChange={(e) => setSearchSessionTerm(e.target.value)}
                  className="pl-9 h-9 bg-muted/50 border-0"
                />
              </div>
            </div>

            <div className="flex-1 overflow-auto border rounded-xl bg-card shadow-sm">
              {loadingSessions ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
                  <p>Cargando historial...</p>
                </div>
              ) : filteredSessions.length > 0 ? (
                <Table>
                  <TableHeader className="bg-muted/50">
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
                      <TableRow key={session.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-muted-foreground" />
                            {session.sector}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            {new Date(session.startTime).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {session.totalProducts}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {session.totalUnits}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(session)}
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
                <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                  <FileText className="w-12 h-12 mb-4 opacity-20" />
                  <p>No hay conteos finalizados aún.</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* --- TAB: AUDITORÍAS --- */}
          <TabsContent value="audits" className="flex-1 overflow-hidden flex flex-col data-[state=inactive]:hidden">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar reporte..."
                  value={searchReportTerm}
                  onChange={(e) => handleSearchReport(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Input
                placeholder="Filtrar por sucursal..."
                value={filterBranch}
                onChange={(e) => handleFilterBranch(e.target.value)}
              />
              <Input
                placeholder="Filtrar por sector..."
                value={filterSector}
                onChange={(e) => handleFilterSector(e.target.value)}
              />
            </div>

            <div className="flex-1 overflow-auto">
              {filteredReports.length === 0 ? (
                <Card className="p-12 text-center">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
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
                <div className="space-y-3">
                  {filteredReports.map((report) => (
                    <Link to={`/reports/${report.id}`} key={report.id} className="block hover:bg-muted/50 rounded-lg transition-colors">
                      <Card className="p-4 cursor-pointer">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-foreground">{report.name}</h3>
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
                              onClick={() => handleExportExcel(report)}
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

      {/* Hidden Template for Image Generation (Auditorías) */}
      <div className="fixed left-[-9999px] top-0">
        <ReportTemplate ref={reportTemplateRef} report={reportToExport} />
      </div>
    </div>
  );
}