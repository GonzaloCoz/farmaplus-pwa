import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CyclicItem, CyclicInventoryStats } from "@/services/cyclicInventoryService";

/**
 * ReportExporter
 * Utilidad para generar reportes profesionales de inventario (Excel y PDF).
 */
export const ReportExporter = {
  /**
   * Exporta la lista de items a un archivo Excel (.xlsx)
   */
  exportToExcel: (items: CyclicItem[], labName: string, branchName: string) => {
    try {
      const fileName = `Inventario_${labName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.xlsx`;
      
      // Mapear datos para las pestañas
      const mapItem = (item: CyclicItem) => ({
        "EAN": item.ean,
        "Producto": item.name,
        "Categoría": item.category || "Varios",
        "Cant. Sistema": item.systemQuantity,
        "Cant. Contada": item.countedQuantity,
        "Diferencia": item.countedQuantity - item.systemQuantity,
        "Costo": item.cost,
        "Valor Diferencia": (item.countedQuantity - item.systemQuantity) * item.cost,
        "Estado": item.status === "adjusted" ? "Ajustado" : (item.status === "controlled" ? "Controlado" : "Pendiente")
      });

      const pending = items.filter(i => i.status === "pending").map(mapItem);
      const controlled = items.filter(i => i.status === "controlled").map(mapItem);
      const adjusted = items.filter(i => i.status === "adjusted").map(mapItem);

      const wb = XLSX.utils.book_new();

      // Crear hojas si hay datos
      if (items.length > 0) {
        const wsAll = XLSX.utils.json_to_sheet(items.map(mapItem));
        XLSX.utils.book_append_sheet(wb, wsAll, "Todo");
      }
      
      if (pending.length > 0) {
        const wsPending = XLSX.utils.json_to_sheet(pending);
        XLSX.utils.book_append_sheet(wb, wsPending, "Pendientes");
      }

      if (controlled.length > 0) {
        const wsControlled = XLSX.utils.json_to_sheet(controlled);
        XLSX.utils.book_append_sheet(wb, wsControlled, "Controlados");
      }

      if (adjusted.length > 0) {
        const wsAdjusted = XLSX.utils.json_to_sheet(adjusted);
        XLSX.utils.book_append_sheet(wb, wsAdjusted, "Ajustados");
      }

      // Guardar archivo
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error("Error al exportar Excel:", error);
      throw error;
    }
  },

  /**
   * Exporta la lista de items a un archivo PDF (.pdf)
   */
  exportToPDF: (items: CyclicItem[], labName: string, branchName: string) => {
    try {
      const doc = new jsPDF() as any;
      const fileName = `Reporte_${labName.replace(/\s+/g, "_")}.pdf`;

      // Header
      doc.setFontSize(20);
      doc.setTextColor(40);
      doc.text("Reporte de Inventario Cíclico", 14, 22);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Sucursal: ${branchName}`, 14, 30);
      doc.text(`Laboratorio: ${labName}`, 14, 35);
      doc.text(`Fecha: ${format(new Date(), "PPP", { locale: es })}`, 14, 40);

      // Resumen
      const totalItems = items.length;
      const controlled = items.filter(i => i.status !== "pending").length;
      const differences = items.filter(i => i.countedQuantity !== i.systemQuantity && i.status !== "pending").length;

      doc.setFontSize(12);
      doc.setTextColor(40);
      doc.text("Resumen de Control", 14, 52);
      
      doc.setFontSize(10);
      doc.text([
        `Total productos en laboratorio: ${totalItems}`,
        `Productos controlados: ${controlled} (${Math.round((controlled/totalItems)*100)}%)`,
        `Productos con diferencias: ${differences}`
      ], 14, 58);

      // Tabla de Diferencias (Interesante para el reporte)
      const diffItems = items
        .filter(i => i.status !== "pending" && i.countedQuantity !== i.systemQuantity)
        .map(i => [
          i.ean,
          i.name.length > 35 ? i.name.substring(0, 32) + "..." : i.name,
          i.systemQuantity.toString(),
          i.countedQuantity.toString(),
          (i.countedQuantity - i.systemQuantity).toString(),
          `$${(Math.abs(i.countedQuantity - i.systemQuantity) * i.cost).toLocaleString("es-AR")}`
        ]);

      if (diffItems.length > 0) {
        doc.setFontSize(12);
        doc.text("Detalle de Diferencias", 14, 85);
        
        doc.autoTable({
          startY: 90,
          head: [["EAN", "Producto", "Sist.", "Cont.", "Diff.", "Valor (Abs)"]],
          body: diffItems,
          theme: "striped",
          headStyles: { fillStyle: "#1a1a1a", textColor: 255 },
          columnStyles: {
            2: { halign: "right" },
            3: { halign: "right" },
            4: { halign: "right" },
            5: { halign: "right" }
          }
        });
      } else {
        doc.text("No se encontraron diferencias en los productos controlados.", 14, 90);
      }

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(
          `Farmaplus - Sistema de Inventario Cíclico | Página ${i} de ${pageCount}`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10,
          { align: "center" }
        );
      }

      doc.save(fileName);
    } catch (error) {
      console.error("Error al exportar PDF:", error);
      throw error;
    }
  },

  /**
   * Exporta un resumen de todos los laboratorios de la sucursal a Excel
   */
  exportSummaryToExcel: (labs: CyclicInventoryStats[], branchName: string) => {
    try {
      const fileName = `Resumen_Inventario_${branchName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.xlsx`;
      
      const mapLab = (lab: CyclicInventoryStats) => ({
        "Laboratorio": lab.labName,
        "Categoría": lab.category || "Varios",
        "Estado": lab.status === "controlado" ? "Controlado" : (lab.status === "por_controlar" ? "En Proceso" : "Pendiente"),
        "Progreso": `${lab.progress}%`,
        "Diferencia Neta": lab.netValue,
        "Negativo": lab.negativeValue,
        "Positivo": lab.positiveValue,
        "Unidades Sistema": lab.totalSystemUnits,
        "Diferencia Unidades": lab.netUnits
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(labs.map(mapLab));
      XLSX.utils.book_append_sheet(wb, ws, "Resumen Sucursal");

      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error("Error al exportar resumen Excel:", error);
      throw error;
    }
  },

  /**
   * Exporta un resumen de todos los laboratorios de la sucursal a PDF
   */
  exportSummaryToPDF: (labs: CyclicInventoryStats[], branchName: string) => {
    try {
      const doc = new jsPDF() as any;
      const fileName = `Resumen_Inventario_${branchName.replace(/\s+/g, "_")}.pdf`;

      // Header
      doc.setFontSize(20);
      doc.setTextColor(40);
      doc.text("Resumen General de Inventario", 14, 22);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Sucursal: ${branchName}`, 14, 30);
      doc.text(`Fecha: ${format(new Date(), "PPP", { locale: es })}`, 14, 35);

      // Resumen Global
      const totalLabs = labs.length;
      const controlled = labs.filter(l => l.status === "controlado").length;
      const totalNet = labs.reduce((acc, l) => acc + l.netValue, 0);

      doc.setFontSize(12);
      doc.setTextColor(40);
      doc.text("Métricas Globales", 14, 48);
      
      doc.setFontSize(10);
      doc.text([
        `Total laboratorios: ${totalLabs}`,
        `Completados: ${controlled} (${Math.round((controlled/totalLabs)*100)}%)`,
        `Diferencia Neta Sucursal: $${totalNet.toLocaleString("es-AR")}`
      ], 14, 54);

      // Tabla de Laboratorios
      const tableData = labs.map(l => [
        l.labName.length > 25 ? l.labName.substring(0, 22) + "..." : l.labName,
        l.status === "controlado" ? "Completo" : (l.status === "por_controlar" ? "En Proc." : "Pend."),
        `${l.progress}%`,
        `$${l.netValue.toLocaleString("es-AR")}`,
        l.netUnits.toString()
      ]);

      doc.autoTable({
        startY: 70,
        head: [["Laboratorio", "Estado", "Avance", "Dif. Neta", "Unidades"]],
        body: tableData,
        theme: "striped",
        headStyles: { fillStyle: "#1a1a1a", textColor: 255 },
        columnStyles: {
          2: { halign: "center" },
          3: { halign: "right" },
          4: { halign: "right" }
        }
      });

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(
          `Farmaplus - Resumen Consolidado | Página ${i} de ${pageCount}`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10,
          { align: "center" }
        );
      }

      doc.save(fileName);
    } catch (error) {
      console.error("Error al exportar resumen PDF:", error);
      throw error;
    }
  }
};
