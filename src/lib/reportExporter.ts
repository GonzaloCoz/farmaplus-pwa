import * as XLSX from "xlsx-js-style";
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
   * Obtiene el HTML exacto de impresión de Plex 25 (QuickReport)
   */
  /**
   * Obtiene el HTML exacto de impresión de Plex 25 (QuickReport) con soporte para filtros y agrupamientos
   */
  getReportHTML: (
    items: CyclicItem[],
    labName: string,
    branchName: string,
    options?: {
      groupBy?: string;
      stockFilter?: string;
    }
  ): string => {
    const PLEX_LOGO_B64 = "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";

    const fmtMoney = (val: number | null | undefined): string => {
      if (val === null || val === undefined || isNaN(val) || val === 0) return "0,00";
      return val.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const fmtInt = (val: number | null | undefined): string => {
      if (val === null || val === undefined || isNaN(val)) return "0";
      return Math.round(val).toString();
    };

    const fechaLiteral = format(new Date(), "EEEE d 'de' MMMM 'de' yyyy", { locale: es });

    const stockFilter = options?.stockFilter || 'no_filtrar';
    const groupBy = options?.groupBy || 'laboratorio';

    // 1. Filtrar por Cantidad de Stock (Comportamiento idéntico a Plex stock.dll)
    let filteredItems = [...items];
    if (stockFilter === 'mayor_a') {
      filteredItems = filteredItems.filter(i => (i.systemQuantity ?? 0) > 0);
    } else if (stockFilter === 'menor_a') {
      filteredItems = filteredItems.filter(i => (i.systemQuantity ?? 0) <= 0);
    } else if (stockFilter === 'debajo_minimo') {
      filteredItems = filteredItems.filter(i => (i.minimo !== undefined && i.minimo > 0) && (i.systemQuantity ?? 0) < i.minimo);
    } else if (stockFilter === 'sin_minimo') {
      filteredItems = filteredItems.filter(i => !i.minimo || i.minimo === 0);
    } else if (stockFilter === 'encima_minimo') {
      filteredItems = filteredItems.filter(i => (i.minimo !== undefined && i.minimo > 0) && (i.systemQuantity ?? 0) >= i.minimo);
    }

    const sortedItems = filteredItems.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    let tableContentHtml = "";
    let grandTotPvp = 0;
    let grandTotCosto = 0;

    const renderRow = (item: CyclicItem) => {
      const cant = item.systemQuantity ?? 0;
      const unid = 0;
      const pvp = Number(item.price) || 0;
      const costo = Number(item.cost) || 0;
      const pvpTot = cant * pvp;
      const costoTot = cant * costo;

      return {
        html: `<tr>
          <td class="col-troquel">${item.troquel || ""}</td>
          <td class="col-codebar">${item.ean || ""}</td>
          <td class="col-producto">${item.name || ""}</td>
          <td class="col-num">${fmtInt(cant)}</td>
          <td class="col-num">${fmtInt(unid)}</td>
          <td class="col-num">${item.minimo && item.minimo > 0 ? fmtInt(item.minimo) : ""}</td>
          <td class="col-money">${fmtMoney(pvp)}</td>
          <td class="col-money">${fmtMoney(pvpTot)}</td>
          <td class="col-money">${fmtMoney(costo)}</td>
          <td class="col-money">${fmtMoney(costoTot)}</td>
        </tr>`,
        pvpTot,
        costoTot
      };
    };

    if (sortedItems.length === 0) {
      tableContentHtml = `<tr>
        <td colspan="10" style="text-align: center; padding: 28px 0; color: #666; font-style: italic;">
          No se encontraron productos con el filtro de stock seleccionado.
        </td>
      </tr>`;
    } else if (groupBy === 'rubro') {
      // 2.A. Agrupar por Rubro (Categoría)
      const groups: Record<string, CyclicItem[]> = {};
      sortedItems.forEach(item => {
        const cat = item.category?.trim() || "Varios";
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(item);
      });

      const groupNames = Object.keys(groups).sort();
      groupNames.forEach((gName, gIdx) => {
        const gItems = groups[gName];
        let gPvp = 0;
        let gCosto = 0;

        tableContentHtml += `<tr class="group-header-row">
          <td colspan="10" style="padding-top: ${gIdx === 0 ? '4px' : '12px'}; padding-bottom: 3px; font-weight: bold; font-size: 9.5px; border-bottom: 1.2px solid #000; text-align: left; background: #fff;">
            Rubro: ${gName.toUpperCase()}
          </td>
        </tr>`;

        gItems.forEach(item => {
          const r = renderRow(item);
          gPvp += r.pvpTot;
          gCosto += r.costoTot;
          grandTotPvp += r.pvpTot;
          grandTotCosto += r.costoTot;
          tableContentHtml += r.html;
        });

        tableContentHtml += `<tr class="totals-row">
          <td colspan="6" style="text-align: left; font-weight: bold;">Total Rubro ${gName.toUpperCase()}:</td>
          <td></td>
          <td class="col-money">${fmtMoney(gPvp)}</td>
          <td></td>
          <td class="col-money">${fmtMoney(gCosto)}</td>
        </tr>`;
      });

      if (groupNames.length > 1) {
        tableContentHtml += `<tr class="totals-row" style="border-top: 2px solid #000;">
          <td colspan="6" style="text-align: left; font-weight: bold;">TOTAL GENERAL:</td>
          <td></td>
          <td class="col-money" style="font-weight: bold;">${fmtMoney(grandTotPvp)}</td>
          <td></td>
          <td class="col-money" style="font-weight: bold;">${fmtMoney(grandTotCosto)}</td>
        </tr>`;
      }
    } else if (groupBy === 'psicofarmaco') {
      // 2.B. Agrupar por Psicofármaco
      const isPsico = (item: CyclicItem) => {
        return Boolean(
          (item as any).id_psicofarmaco ||
          (item as any).is_psychotropic ||
          /\b(clona|diaze|loraze|alpraz|mida|morf|fenta|oxicod|tramad|metadona|zolpidem|psico|fenobarbital|haloperidol|risperidona|quetiapina|sertralina|fluoxetina|paroxetina)\b/i.test(item.name || '')
        );
      };

      const groups: Record<string, CyclicItem[]> = {
        "Psicofármacos": [],
        "Sin Asignar": []
      };

      sortedItems.forEach(item => {
        if (isPsico(item)) {
          groups["Psicofármacos"].push(item);
        } else {
          groups["Sin Asignar"].push(item);
        }
      });

      const activeGroupNames = Object.keys(groups).filter(k => groups[k].length > 0);
      activeGroupNames.forEach((gName, gIdx) => {
        const gItems = groups[gName];
        let gPvp = 0;
        let gCosto = 0;

        tableContentHtml += `<tr class="group-header-row">
          <td colspan="10" style="padding-top: ${gIdx === 0 ? '4px' : '12px'}; padding-bottom: 3px; font-weight: bold; font-size: 9.5px; border-bottom: 1.2px solid #000; text-align: left; background: #fff;">
            Psicofármaco: ${gName.toUpperCase()}
          </td>
        </tr>`;

        gItems.forEach(item => {
          const r = renderRow(item);
          gPvp += r.pvpTot;
          gCosto += r.costoTot;
          grandTotPvp += r.pvpTot;
          grandTotCosto += r.costoTot;
          tableContentHtml += r.html;
        });

        tableContentHtml += `<tr class="totals-row">
          <td colspan="6" style="text-align: left; font-weight: bold;">Total Psicofármaco ${gName.toUpperCase()}:</td>
          <td></td>
          <td class="col-money">${fmtMoney(gPvp)}</td>
          <td></td>
          <td class="col-money">${fmtMoney(gCosto)}</td>
        </tr>`;
      });

      if (activeGroupNames.length > 1) {
        tableContentHtml += `<tr class="totals-row" style="border-top: 2px solid #000;">
          <td colspan="6" style="text-align: left; font-weight: bold;">TOTAL GENERAL:</td>
          <td></td>
          <td class="col-money" style="font-weight: bold;">${fmtMoney(grandTotPvp)}</td>
          <td></td>
          <td class="col-money" style="font-weight: bold;">${fmtMoney(grandTotCosto)}</td>
        </tr>`;
      }
    } else {
      // 2.C. Agrupar por Laboratorio (Estilo estándar Plex)
      let totPvp = 0;
      let totCosto = 0;

      const rows = sortedItems.map(item => {
        const r = renderRow(item);
        totPvp += r.pvpTot;
        totCosto += r.costoTot;
        return r.html;
      }).join("");

      tableContentHtml = rows + `
        <tr class="totals-row">
          <td colspan="6" style="text-align: left;">Total Laboratorio:</td>
          <td></td>
          <td class="col-money">${fmtMoney(totPvp)}</td>
          <td></td>
          <td class="col-money">${fmtMoney(totCosto)}</td>
        </tr>`;
    }

    const stockFilterLabels: Record<string, string> = {
      mayor_a: "Stock Mayor a 0",
      menor_a: "Stock Menor o Igual a 0",
      debajo_minimo: "Stock Debajo del Mínimo",
      sin_minimo: "Sin Mínimo",
      encima_minimo: "Stock Encima del Mínimo",
    };
    const activeFilterSubtitle = stockFilterLabels[stockFilter]
      ? `<div style="font-size: 8.5px; color: #444; margin-top: 2px;">Filtro: ${stockFilterLabels[stockFilter]} (${sortedItems.length} productos)</div>`
      : "";

    const groupSubtitle = groupBy !== 'laboratorio'
      ? ` &nbsp;|&nbsp; <span>Agrupado por:</span> ${groupBy === 'rubro' ? 'Rubro' : 'Psicofármacos'}`
      : "";

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Listado de Stock - ${labName}</title>
<style>
  @page {
    size: A4 portrait;
    margin: 8mm 7mm;
  }
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #000;
    font-family: Arial, Helvetica, sans-serif;
    line-height: 1.2;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body {
    padding: 8mm 7mm;
    width: 210mm;
    margin: 0 auto;
  }
  @media print {
    body {
      padding: 0;
      width: 100%;
      margin: 0;
    }
  }
  .top-notice {
    text-align: center;
    font-size: 8px;
    color: #555;
    letter-spacing: 0.2px;
    margin-bottom: 8px;
  }
  .header-table {
    width: 100%;
    border-collapse: collapse;
  }
  .header-table td {
    vertical-align: top;
  }
  .empresa-nombre {
    font-size: 13px;
    font-weight: bold;
    letter-spacing: 0.1px;
  }
  .empresa-direccion {
    font-size: 8.5px;
    color: #222;
    margin-top: 10px;
  }
  .empresa-cuit {
    font-size: 8.5px;
    font-weight: bold;
    color: #000;
    margin-top: 2px;
  }
  .empresa-iva {
    font-size: 8.5px;
    color: #222;
    margin-top: 1px;
  }
  .header-right {
    text-align: right;
  }
  .header-logo {
    height: 26px;
    display: inline-block;
  }
  .header-date {
    font-size: 8.5px;
    color: #333;
    margin-top: 20px;
  }
  .title-block {
    text-align: center;
    margin-top: -8px;
    margin-bottom: 10px;
  }
  .report-title {
    font-size: 13px;
    font-weight: bold;
  }
  .report-sucursal {
    font-size: 10.5px;
    font-weight: bold;
    margin-top: 1px;
  }
  .lab-header {
    font-size: 10px;
    font-weight: bold;
    margin-bottom: 4px;
  }
  .lab-header span {
    margin-right: 16px;
  }
  .table-data {
    width: 100%;
    border-collapse: collapse;
    font-size: 8.5px;
    page-break-inside: auto;
  }
  .table-data thead {
    display: table-header-group;
  }
  .table-data thead th {
    padding: 3px 2px;
    font-weight: bold;
    border-bottom: 1.2px solid #000;
  }
  .table-data tbody tr {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .table-data tbody tr td {
    padding: 2px 2px;
  }
  .col-troquel {
    width: 7%;
    text-align: left;
  }
  .col-codebar {
    width: 13%;
    text-align: left;
    letter-spacing: -0.2px;
  }
  .col-producto {
    width: 32%;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 4px !important;
  }
  .col-num {
    width: 4.5%;
    text-align: right;
  }
  .col-money {
    width: 8.5%;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .totals-row {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .totals-row td {
    border-top: 1px solid #000;
    padding-top: 4px;
    font-weight: bold;
  }
</style>
</head>
<body>
  <div class="top-notice">DOCUMENTO NO VALIDO COMO FACTURA</div>
  <table class="header-table">
    <tr>
      <td style="width: 58%;">
        <div class="empresa-nombre">FARMAPLUS ADMINISTRACION</div>
        <div class="empresa-direccion">, BUENOS AIRES ()</div>
        <div class="empresa-cuit">CUIT</div>
        <div class="empresa-iva">IVA Responsable Inscripto</div>
      </td>
      <td style="width: 42%;" class="header-right">
        <img class="header-logo" src="data:image/png;base64,${PLEX_LOGO_B64}" alt="plexDK" />
        <div class="header-date">${fechaLiteral}</div>
      </td>
    </tr>
  </table>

  <div class="title-block">
    <div class="report-title">Listado de Stock</div>
    <div class="report-sucursal">Sucursal: ${branchName}</div>
    ${activeFilterSubtitle}
  </div>

  <div class="lab-header">
    <span>Laboratorio:</span> ${labName || "Sin Laboratorio"}${groupSubtitle}
  </div>

  <table class="table-data">
    <thead>
      <tr>
        <th class="col-troquel" style="text-align: left;">Troquel</th>
        <th class="col-codebar" style="text-align: left;">Cód.Barras</th>
        <th class="col-producto" style="text-align: left;">Producto</th>
        <th class="col-num">Cajas</th>
        <th class="col-num">Unid.</th>
        <th class="col-num">Min.</th>
        <th class="col-money">PVP</th>
        <th class="col-money">PVP Total</th>
        <th class="col-money">Costo</th>
        <th class="col-money">Costo Total</th>
      </tr>
    </thead>
    <tbody>
      ${tableContentHtml}
    </tbody>
  </table>
</body>
</html>`;
  },

  /**
   * Exporta e imprime el reporte con el canvas y diseño exacto de Plex 25 (QuickReport)
   */
  exportToPDF: (
    items: CyclicItem[],
    labName: string,
    branchName: string,
    options?: {
      groupBy?: string;
      stockFilter?: string;
    }
  ) => {
    try {
      const html = ReportExporter.getReportHTML(items, labName, branchName, options);

      // Imprime silenciosamente vía iframe nativo de Chromium / WebView2
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);

      const frameDoc = iframe.contentWindow?.document;
      if (frameDoc) {
        frameDoc.open();
        frameDoc.write(html);
        frameDoc.close();

        iframe.contentWindow?.focus();
        setTimeout(() => {
          iframe.contentWindow?.print();
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 2000);
        }, 250);
      }
    } catch (error) {
      console.error("Error al imprimir reporte:", error);
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
,
  /**
   * Exporta el avance general de las sucursales a Excel con desglose por rubro
   * siguiendo fielmente la estructura de 'Plantilla de guardado de avance de stock.xlsx' (Hoja DataSet)
   */
  exportBranchMonitorToExcel: (
    branches: Array<{
      branchName: string;
      daysRemaining?: number;
      assignedDays?: number;
      days?: number;
      progress?: number;
      units?: number;
      surplus?: number;
      shortage?: number;
      netDiff?: number;
      unitDeviation?: number;
      adjustments?: number;
      absDeviation?: number;
      categories?: Record<string, any>;
    }>,
    customFileName?: string
  ) => {
    try {
      const CATEGORIES_DEF = [
        { key: 'MEDICAMENTOS', label: 'Medicamentos' },
        { key: 'PERFUMERIA', label: 'Perfumería' },
        { key: 'ACCESORIOS', label: 'Accesorios' },
        { key: 'VARIOS', label: 'Varios' },
      ];

      const normalizeCat = (s: string) =>
        (s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

      const CURRENCY_FMT = '"$"\ #,##0.00';
      const PERCENT_FMT = '0.00%';

      // 1. Encabezados exactos de la plantilla
      const data: any[][] = [
        ['Sucursal', 'Rubro', 'Dias', '% Avance', 'Unidades', 'Sobrantes', 'Faltantes', 'Neto', 'Desvio', 'Ajustes', 'Balance']
      ];

      const dataRowIndices: number[] = [];
      const branchRowIndices: number[] = [];

      branches.forEach((b) => {
        // A. Fila principal de la sucursal
        const branchDays = b.daysRemaining !== undefined && b.assignedDays !== undefined
          ? `${b.daysRemaining}/${b.assignedDays}`
          : (b.days !== undefined ? `${b.days}` : '-');

        const branchProgress = Number(((b.progress ?? 0) / 100).toFixed(4));
        const branchUnits = Number(b.units ?? 0);
        const branchSurplus = Number(b.surplus ?? 0);
        const branchShortage = Number(b.shortage ?? 0);
        const branchNet = Number(b.netDiff ?? 0);
        const branchDeviation = Number(b.unitDeviation ?? 0);
        const branchAdjustments = Number(b.adjustments ?? 0);
        const branchBalance = Number(b.absDeviation ?? 0);

        data.push([
          b.branchName,
          '-',
          branchDays,
          branchProgress,
          branchUnits,
          branchSurplus,
          branchShortage,
          branchNet,
          branchDeviation,
          branchAdjustments,
          branchBalance
        ]);
        const bRowIdx = data.length;
        dataRowIndices.push(bRowIdx);
        branchRowIndices.push(bRowIdx);

        // B. 4 Filas de Rubros
        CATEGORIES_DEF.forEach((cat) => {
          const target = normalizeCat(cat.key);
          const stats = Object.entries(b.categories || {}).find(([k]) => normalizeCat(k) === target)?.[1] || {
            totalLabs: 0,
            controlledLabs: 0,
            progress: 0,
            totalItems: 0,
            controlledItems: 0,
            positiveUnits: 0,
            negativeUnits: 0,
            netUnits: 0,
            totalDeviationUnits: 0,
            totalSystemUnits: 0,
            adjustmentsValue: 0,
            balanceValue: 0,
          };

          const catDays = stats.totalLabs > 0
            ? `${stats.controlledLabs}/${stats.totalLabs}`
            : '-';

          const catProgress = Number(((stats.progress ?? 0) / 100).toFixed(4));
          const catUnits = Number(stats.totalSystemUnits > 0
            ? stats.totalSystemUnits
            : (stats.controlledItems > 0 ? stats.controlledItems : stats.totalItems));
          const catSurplus = Number(stats.positiveUnits ?? 0);
          const catShortage = Number(stats.negativeUnits ?? 0);
          const catNet = Number(stats.netUnits !== undefined && stats.netUnits !== null ? stats.netUnits : (catSurplus + catShortage));
          const catDeviation = Number(stats.totalDeviationUnits !== undefined && stats.totalDeviationUnits !== null ? stats.totalDeviationUnits : (catSurplus + Math.abs(catShortage)));
          const catAdjustments = Number(stats.adjustmentsValue ?? 0);
          const catBalance = Number(stats.balanceValue ?? 0);

          data.push([
            '-',
            cat.label,
            catDays,
            catProgress,
            catUnits,
            catSurplus,
            catShortage,
            catNet,
            catDeviation,
            catAdjustments,
            catBalance
          ]);
          dataRowIndices.push(data.length);
        });

        // C. Fila separadora vacía
        data.push(['', '', '', '', '', '', '', '', '', '', '']);
      });

      const ws = XLSX.utils.aoa_to_sheet(data);

      // 1. Títulos de columnas en Negrita (Fila 1)
      ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1', 'I1', 'J1', 'K1'].forEach((cellKey) => {
        if (ws[cellKey]) {
          ws[cellKey].s = {
            font: { bold: true }
          };
        }
      });

      // 2. Formatear celdas numéricas y porcentajes de todas las filas
      dataRowIndices.forEach((rowIdx) => {
        // Col D (% Avance)
        const cellD = ws['D' + rowIdx];
        if (cellD && typeof cellD.v === 'number') {
          cellD.z = PERCENT_FMT;
        }

        // Col J (Ajustes)
        const cellJ = ws['J' + rowIdx];
        if (cellJ && typeof cellJ.v === 'number') {
          cellJ.z = CURRENCY_FMT;
        }

        // Col K (Balance)
        const cellK = ws['K' + rowIdx];
        if (cellK && typeof cellK.v === 'number') {
          cellK.z = CURRENCY_FMT;
        }
      });

      // 3. Negrita para Nombre de Sucursal (Col A) y % Avance General (Col D)
      //    (Exclusivo para la fila general de la sucursal, no para los rubros)
      branchRowIndices.forEach((bIdx) => {
        // Celda A: Nombre de sucursal
        const cellA = ws['A' + bIdx];
        if (cellA) {
          cellA.s = {
            font: { bold: true }
          };
        }

        // Celda D: % Avance general
        const cellD = ws['D' + bIdx];
        if (cellD) {
          cellD.s = {
            font: { bold: true }
          };
        }
      });

      // Anchos de columna óptimos
      ws['!cols'] = [
        { wch: 22 }, // Sucursal
        { wch: 16 }, // Rubro
        { wch: 12 }, // Dias
        { wch: 12 }, // % Avance
        { wch: 12 }, // Unidades
        { wch: 12 }, // Sobrantes
        { wch: 12 }, // Faltantes
        { wch: 12 }, // Neto
        { wch: 12 }, // Desvio
        { wch: 18 }, // Ajustes
        { wch: 18 }, // Balance
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'DataSet');

      const fileName = customFileName || `Avance_Stock_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error('Error al exportar avance de stock a Excel:', error);
      throw error;
    }
  }
};
