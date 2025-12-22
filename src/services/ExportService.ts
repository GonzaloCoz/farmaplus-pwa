import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
import { format, isSameDay, isSameWeek, isSameMonth, isSameYear, parseISO, fromUnixTime, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { ExportOptions } from "@/components/modals/ExportOptionsModal";
import { ExpirationItem } from "./expirationDB";

interface ReportItem {
    productName: string;
    ean: string;
    batchNumber: string;
    expirationDate: string;
    quantity: number;
    status: string;
    actionDate?: number;
    destinationBranch?: string;
    plexShipmentNumber?: string;
    branchName: string;
    sector?: string;
}

export const generateExport = (
    items: ExpirationItem[],
    options: ExportOptions,
    branchName: string
) => {
    // 1. Flatten and Filter Data
    const reportData = filterData(items, options);

    // 2. Generate File
    if (options.format === 'pdf') {
        generatePDF(reportData, options, branchName);
    } else {
        generateExcel(reportData, options, branchName);
    }
};

const filterData = (items: ExpirationItem[], options: ExportOptions): ReportItem[] => {
    const flatList: ReportItem[] = [];
    const { from, to } = options.dateRange;

    items.forEach(item => {
        item.batches.forEach(batch => {
            // Apply Status Filter
            const batchStatus = batch.status || 'active';
            const isStatusMatch = options.selectedStatuses.includes('all') || options.selectedStatuses.includes(batchStatus);

            if (!isStatusMatch) {
                return;
            }

            // Apply Date Filter
            // For Date Range logic:
            // 1. If item has Action Date (Resolved), check if it falls within Pending [from, to]
            // 2. If item is Active (Pending), deciding factor?
            //    - If user filters by "Today", usually wants activity of today. Active items don't have activity date.
            //    - If user filters by "All" or a Range that includes Today, maybe include them?
            //    - Current logic: Only include resolved items matching date range.
            //    - Exception: If range covers "NOW" (e.g. including today), we include Active items if status filter permits.
            //    - Simplified: Active items are included if status filter permits AND the range includes the current creation/snapshot time (effectively if range includes today).

            // Let's use strict interval check for actionDate.
            let isDateMatch = false;

            if (batch.actionDate) {
                const actionDate = fromUnixTime(batch.actionDate / 1000);
                if (isWithinInterval(actionDate, { start: from, end: to })) {
                    isDateMatch = true;
                }
            } else if (batchStatus === 'active') {
                // Include active items if the range includes "Today"
                // This is a reasonable assumption for "Current Status" reports
                const now = new Date();
                if (isWithinInterval(now, { start: from, end: to })) {
                    isDateMatch = true;
                }
            }

            if (isDateMatch) {
                flatList.push({
                    productName: item.productName,
                    ean: item.ean,
                    batchNumber: batch.batchNumber,
                    expirationDate: batch.expirationDate,
                    quantity: batch.quantity,
                    status: batchStatus,
                    actionDate: batch.actionDate,
                    destinationBranch: batch.destinationBranch,
                    plexShipmentNumber: batch.plexShipmentNumber,
                    branchName: item.branchName,
                });
            }
        });
    });

    return flatList;
};

export const generatePDF = (data: ReportItem[], options: ExportOptions, branchName: string) => {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
    });

    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    let y = margin;

    // --- Elegant Header ---
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Reporte de Control de Vencimientos", margin, y);
    y += 10;

    // Fine separator line
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + contentWidth, y);
    y += 10;

    // --- Report Metadata ---
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);

    doc.text(`SUCURSAL: ${branchName.toUpperCase()}`, margin, y);
    doc.text(`FECHA DE EMISIÓN: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}`, margin + contentWidth, y, { align: "right" });
    y += 6;

    const fromStr = format(options.dateRange.from, "dd/MM/yy");
    const toStr = format(options.dateRange.to, "dd/MM/yy");
    doc.text(`PERIODO: ${fromStr} - ${toStr} (${getRangeLabel(options.rangeType).toUpperCase()})`, margin, y);

    const statuses = options.selectedStatuses.includes('all')
        ? "TODOS"
        : options.selectedStatuses.map(s => getStatusLabel(s).toUpperCase()).join(", ");
    doc.text(`ESTADOS: ${statuses}`, margin + contentWidth, y, { align: "right" });
    y += 12;

    // --- Key Metrics ---
    doc.setDrawColor(240, 240, 240);
    doc.setFillColor(250, 250, 250);
    doc.rect(margin, y, contentWidth, 15, 'F');

    doc.setTextColor(60, 60, 60);
    doc.setFont("helvetica", "bold");
    const totalItems = data.length;
    const totalQuantity = data.reduce((acc, item) => acc + item.quantity, 0);

    doc.text(`TOTAL PRODUCTOS: ${totalItems}`, margin + 5, y + 9);
    doc.text(`TOTAL UNIDADES: ${totalQuantity}`, margin + (contentWidth / 2), y + 9);
    y += 25;

    // --- Table Header ---
    const drawTableHeader = (startY: number) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(40, 40, 40);

        doc.text("PRODUCTO", margin, startY);
        doc.text("LOTE / VENC.", margin + 70, startY);
        doc.text("CANT.", margin + 105, startY, { align: "center" });
        doc.text("ESTADO", margin + 115, startY);
        doc.text("DETALLES / ACCIÓN", margin + contentWidth, startY, { align: "right" });

        doc.setDrawColor(80, 80, 80);
        doc.setLineWidth(0.3);
        doc.line(margin, startY + 2, margin + contentWidth, startY + 2);
    };

    drawTableHeader(y);
    y += 10;

    // --- Table Content ---
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);

    data.forEach((item, index) => {
        // Page break check
        if (y > pageHeight - 25) {
            drawFooter(doc, pageWidth, pageHeight, margin);
            doc.addPage();
            y = margin + 10;
            drawTableHeader(y);
            y += 10;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(60, 60, 60);
        }

        const productText = item.productName.length > 40 ? item.productName.substring(0, 38) + "..." : item.productName;
        doc.text(productText, margin, y);
        doc.text(`${item.batchNumber} | ${item.expirationDate}`, margin + 70, y);
        doc.text(`${item.quantity}`, margin + 105, y, { align: "center" });
        doc.text(getStatusLabel(item.status), margin + 115, y);

        let details = "-";
        if (item.status === 'transfer') {
            details = item.destinationBranch || "Transferencia";
        } else if (item.actionDate) {
            details = format(fromUnixTime(item.actionDate / 1000), "dd/MM/yyyy");
        }
        doc.text(details, margin + contentWidth, y, { align: "right" });

        // Suburban hairline between rows
        doc.setDrawColor(230, 230, 230);
        doc.setLineWidth(0.1);
        doc.line(margin, y + 2, margin + contentWidth, y + 2);

        y += 8;
    });

    // Final Footer for the last page
    drawFooter(doc, pageWidth, pageHeight, margin);

    doc.save(`Reporte_Vencimientos_${branchName}_${format(new Date(), "yyyyMMdd")}.pdf`);
};

// Helper for professional footer
const drawFooter = (doc: jsPDF, pageWidth: number, pageHeight: number, margin: number) => {
    const pageCount = (doc as any).internal.getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
    doc.text("Farmaplus PWA - Sistema de Gestión de Inventarios", margin, pageHeight - 10);
    doc.text(`Página ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: "right" });
};

const generateExcel = (data: ReportItem[], options: ExportOptions, branchName: string) => {
    const wsData = data.map(item => ({
        "Producto": item.productName,
        "EAN": item.ean,
        "Lote": item.batchNumber,
        "Vencimiento": item.expirationDate,
        "Cantidad": item.quantity,
        "Estado": getStatusLabel(item.status),
        "Fecha Acción": item.actionDate ? format(fromUnixTime(item.actionDate / 1000), "dd/MM/yyyy HH:mm") : "-",
        "Sucursal Destino": item.destinationBranch || "-",
        "Nº Envío Plex": item.plexShipmentNumber || "-",
        "Sucursal Origen": item.branchName
    }));

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    XLSX.writeFile(wb, `Control_Vencimientos_${branchName}.xlsx`);
};

const getRangeLabel = (range: string) => {
    switch (range) {
        case 'day': return "Día/Rango";
        case 'month': return "Mes";
        case 'year': return "Año";
        default: return "Personalizado";
    }
};

const getStatusLabel = (status: string) => {
    switch (status) {
        case 'active': return "Pendiente";
        case 'sold': return "Vendido";
        case 'transfer': return "Transferido";
        case 'return': return "Devolución";
        case 'destroyed': return "Destrucción";
        case 'all': return "Todos";
        default: return status;
    }
};
