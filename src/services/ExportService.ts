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

const generatePDF = (data: ReportItem[], options: ExportOptions, branchName: string) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    let y = 20;

    // --- Header ---
    doc.setFillColor(63, 81, 181); // Indigo Primary
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("Reporte de Control de Vencimientos", 15, 20);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Sucursal: ${branchName}`, 15, 30);
    doc.text(`Generado: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}`, pageWidth - 70, 30);

    y = 50;

    // --- Summary Section ---
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Resumen del Reporte", 15, y);
    y += 10;

    const totalItems = data.length;
    const totalQuantity = data.reduce((acc, item) => acc + item.quantity, 0);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    // Display Date Range
    const fromStr = format(options.dateRange.from, "dd/MM/yy");
    const toStr = format(options.dateRange.to, "dd/MM/yy");
    doc.text(`Periodo: ${fromStr} - ${toStr} (${getRangeLabel(options.rangeType)})`, 15, y);

    // Display Statuses
    const statusLabel = options.selectedStatuses.includes('all')
        ? "Todos"
        : options.selectedStatuses.map(s => getStatusLabel(s)).join(", ");

    // Handle long text wrapping for status
    const splitStatus = doc.splitTextToSize(`Estados: ${statusLabel}`, pageWidth - 100);
    doc.text(splitStatus, 80, y);

    y += (splitStatus.length * 5) + 2;

    doc.text(`Total Ítems: ${totalItems}`, 15, y);
    doc.text(`Total Unidades: ${totalQuantity}`, 80, y);

    y += 15;

    // --- Table Header ---
    const drawTableHeader = (startY: number) => {
        doc.setFillColor(240, 240, 240);
        doc.rect(15, startY, pageWidth - 30, 10, 'F');
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);

        doc.text("Producto", 20, startY + 7);
        doc.text("Lote / Venc", 90, startY + 7);
        doc.text("Cant", 130, startY + 7);
        doc.text("Estado", 150, startY + 7);
        doc.text("Detalle", 185, startY + 7);
    };

    drawTableHeader(y);
    y += 12;

    // --- Table Content ---
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    data.forEach((item, index) => {
        if (y > pageHeight - 20) {
            doc.addPage();
            y = 20;
            drawTableHeader(y);
            y += 12;
        }

        const productName = item.productName.length > 35 ? item.productName.substring(0, 32) + "..." : item.productName;

        // Zebra striping
        if (index % 2 === 1) {
            doc.setFillColor(250, 250, 250);
            doc.rect(15, y - 6, pageWidth - 30, 10, 'F');
        }

        doc.text(productName, 20, y);
        doc.text(`${item.batchNumber} - ${item.expirationDate}`, 90, y);
        doc.text(`${item.quantity}`, 130, y);

        // Status Color (simple dot or text)
        doc.text(getStatusLabel(item.status), 150, y);

        // Details (Transfer info or Action Date)
        let details = "-";
        if (item.status === 'transfer') {
            details = item.destinationBranch || "Inter-Sucursal";
            // if (item.plexShipmentNumber) details += ` (#${item.plexShipmentNumber})`;
        } else if (item.actionDate) {
            details = format(fromUnixTime(item.actionDate / 1000), "dd/MM/yy");
        }
        doc.text(details, 185, y);

        y += 8;

        // Extra line for Plex if needed, to be cleaner
        if (item.plexShipmentNumber) {
            if (y > pageHeight - 20) { doc.addPage(); y = 20; }
            doc.setFontSize(7);
            doc.setTextColor(100, 100, 100);
            doc.text(`Plex: ${item.plexShipmentNumber}`, 185, y - 4); // tucked under detail
            doc.setFontSize(8);
            doc.setTextColor(0, 0, 0);
        }
    });

    doc.save(`Reporte_Vencimientos_${branchName}_${format(new Date(), "yyyyMMdd")}.pdf`);
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
