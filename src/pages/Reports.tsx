import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Trash2, Download, Search, Calendar, MapPin, Layers } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface Report {
  id: string;
  name: string;
  branch: string;
  sector: string;
  date: string;
  timestamp: string;
  results: any;
}

export default function Reports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [filteredReports, setFilteredReports] = useState<Report[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterSector, setFilterSector] = useState("");

  useEffect(() => {
    const storedReports = JSON.parse(localStorage.getItem("inventory-reports") || "[]");
    setReports(storedReports);
    applyFilters(storedReports, searchTerm, filterBranch, filterSector);
  }, []);

  const applyFilters = (reportsToFilter: Report[], search: string, branch: string, sector: string) => {
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

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    applyFilters(reports, value, filterBranch, filterSector);
  };

  const handleFilterBranch = (value: string) => {
    setFilterBranch(value);
    applyFilters(reports, searchTerm, value, filterSector);
  };

  const handleFilterSector = (value: string) => {
    setFilterSector(value);
    applyFilters(reports, searchTerm, filterBranch, value);
  };

  const handleDelete = (id: string) => {
    const updated = reports.filter(r => r.id !== id);
    setReports(updated);
    localStorage.setItem("inventory-reports", JSON.stringify(updated));
    applyFilters(updated, searchTerm, filterBranch, filterSector);
    toast.success("Reporte eliminado");
  };

  const handleExport = (report: Report) => {
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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Reportes</h1>
        <p className="text-muted-foreground">
          Historial de auditorías y reportes de inventario generados
        </p>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar reporte..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
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

      {/* Lista de Reportes */}
      {filteredReports.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground">
            {reports.length === 0 ? "Sin reportes aún" : "Sin resultados"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {reports.length === 0 
              ? "Los reportes que generes aparecerán aquí"
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
                    onClick={() => handleExport(report)}
                    className="hover:bg-success hover:text-success-foreground"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(report.id)}
                    className="hover:bg-destructive hover:text-destructive-foreground"
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
  );
}