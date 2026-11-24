import XLSX from "xlsx-js-style";
import { db } from "@/services/db";

export interface UncountedAuditItem {
    idProducto: string;
    ean: string;
    name: string;
    laboratory: string;
    rubro: string;
    systemStock: number;
    countedQuantity: number;
    diff: number;
    cost: number;
    salePrice: number;
    totalCostLoss: number;
    totalSaleLoss: number;
}

export interface UncountedAuditSummary {
    totalCatalogWithStock: number;
    countedCatalogSkus: number;
    uncountedSkus: number;
    coveragePct: number;
    totalUncountedUnits: number;
    totalUncountedCost: number;
    totalUncountedSale: number;
}

export interface UncountedAuditResult {
    hasCatalog: boolean;
    summary: UncountedAuditSummary;
    items: UncountedAuditItem[];
}

export interface CountedItemRef {
    id_producto?: string | number;
    ean: string;
    quantity: number;
}

export async function computeUncountedCatalogAudit(
    sessionId: string,
    countedItems: CountedItemRef[]
): Promise<UncountedAuditResult> {
    const empty: UncountedAuditResult = {
        hasCatalog: false,
        summary: {
            totalCatalogWithStock: 0,
            countedCatalogSkus: 0,
            uncountedSkus: 0,
            coveragePct: 0,
            totalUncountedUnits: 0,
            totalUncountedCost: 0,
            totalUncountedSale: 0,
        },
        items: [],
    };

    if (!sessionId) return empty;

    const sessionObj = await db.sessions.get(sessionId);
    const dbProducts = await db.precount_products.where("session_id").equals(sessionId).toArray();

    // Unificar catálogo maestro por producto único (id_producto || ean principal)
    type CatalogEntry = {
        idProducto: string;
        primaryEan: string;
        allEans: Set<string>;
        name: string;
        laboratory: string;
        rubro: string;
        systemStock: number;
        cost: number;
        salePrice: number;
    };

    const catalogMap = new Map<string, CatalogEntry>();

    const registerRow = (raw: {
        id_producto?: string | number;
        ean?: string;
        eans?: string[];
        name?: string;
        laboratory?: string;
        rubro?: string;
        category?: string;
        stock?: number;
        systemStock?: number;
        cost?: number;
        salePrice?: number;
        sale_price?: number;
    }) => {
        const cleanId = raw.id_producto ? String(raw.id_producto).trim() : "";
        const cleanEan = raw.ean ? String(raw.ean).trim() : "";
        const key = cleanId ? `ID:${cleanId}` : cleanEan ? `EAN:${cleanEan}` : "";
        if (!key) return;

        const eanList = new Set<string>();
        if (cleanEan) eanList.add(cleanEan);
        if (Array.isArray(raw.eans)) {
            raw.eans.forEach((e) => {
                const s = String(e || "").trim();
                if (s) eanList.add(s);
            });
        }

        const stock = Number(raw.systemStock ?? raw.stock ?? 0) || 0;
        const cost = Number(raw.cost ?? 0) || 0;
        const salePrice = Number(raw.salePrice ?? raw.sale_price ?? 0) || 0;

        const existing = catalogMap.get(key);
        if (existing) {
            eanList.forEach((e) => existing.allEans.add(e));
            if (!existing.primaryEan && cleanEan) existing.primaryEan = cleanEan;
            if (stock > existing.systemStock) existing.systemStock = stock;
            if (!existing.cost && cost > 0) existing.cost = cost;
            if (!existing.salePrice && salePrice > 0) existing.salePrice = salePrice;
            if (!existing.laboratory && raw.laboratory) existing.laboratory = raw.laboratory;
            if (!existing.rubro && (raw.rubro || raw.category)) existing.rubro = raw.rubro || raw.category || "";
            return;
        }

        catalogMap.set(key, {
            idProducto: cleanId,
            primaryEan: cleanEan || Array.from(eanList)[0] || "",
            allEans: eanList,
            name: String(raw.name || `Producto ${cleanEan || cleanId}`).trim(),
            laboratory: String(raw.laboratory || "SIN CLASIFICAR").trim(),
            rubro: String(raw.rubro || raw.category || "Varios").trim(),
            systemStock: stock,
            cost,
            salePrice,
        });
    };

    if (Array.isArray(sessionObj?.master_catalog) && sessionObj.master_catalog.length > 0) {
        sessionObj.master_catalog.forEach((p: any) => registerRow(p));
    }
    if (dbProducts.length > 0) {
        dbProducts.forEach((p: any) => registerRow(p));
    }

    if (catalogMap.size === 0) {
        return empty;
    }

    // Marcar cuáles productos del catálogo sí fueron inventariados
    const countedIds = new Set<string>();
    const countedEans = new Set<string>();
    for (const it of countedItems) {
        if ((Number(it.quantity) || 0) <= 0) continue;
        if (it.id_producto) countedIds.add(String(it.id_producto).trim());
        if (it.ean) countedEans.add(String(it.ean).trim());
    }

    const withStock = Array.from(catalogMap.values()).filter((p) => p.systemStock > 0);
    const uncountedItems: UncountedAuditItem[] = [];
    let countedCatalogSkus = 0;

    for (const prod of withStock) {
        const isCountedById = prod.idProducto && countedIds.has(prod.idProducto);
        let isCountedByEan = false;
        if (!isCountedById) {
            for (const e of prod.allEans) {
                if (countedEans.has(e)) {
                    isCountedByEan = true;
                    break;
                }
            }
        }

        if (isCountedById || isCountedByEan) {
            countedCatalogSkus++;
            continue;
        }

        const totalCostLoss = prod.systemStock * prod.cost;
        const totalSaleLoss = prod.systemStock * prod.salePrice;

        uncountedItems.push({
            idProducto: prod.idProducto,
            ean: prod.primaryEan,
            name: prod.name,
            laboratory: prod.laboratory,
            rubro: prod.rubro,
            systemStock: prod.systemStock,
            countedQuantity: 0,
            diff: -prod.systemStock,
            cost: prod.cost,
            salePrice: prod.salePrice,
            totalCostLoss,
            totalSaleLoss,
        });
    }

    uncountedItems.sort((a, b) => b.totalCostLoss - a.totalCostLoss || b.systemStock - a.systemStock);

    const totalCatalogWithStock = withStock.length;
    const uncountedSkus = uncountedItems.length;
    const coveragePct =
        totalCatalogWithStock > 0 ? Math.round((countedCatalogSkus / totalCatalogWithStock) * 100) : 0;

    const totalUncountedUnits = uncountedItems.reduce((acc, i) => acc + i.systemStock, 0);
    const totalUncountedCost = uncountedItems.reduce((acc, i) => acc + i.totalCostLoss, 0);
    const totalUncountedSale = uncountedItems.reduce((acc, i) => acc + i.totalSaleLoss, 0);

    return {
        hasCatalog: true,
        summary: {
            totalCatalogWithStock,
            countedCatalogSkus,
            uncountedSkus,
            coveragePct,
            totalUncountedUnits,
            totalUncountedCost,
            totalUncountedSale,
        },
        items: uncountedItems,
    };
}

export function exportUncountedAuditExcel(
    audit: UncountedAuditResult,
    branchName: string,
    inventoryTitle: string
) {
    const cleanBranch = (branchName || "Sucursal").replace(/[^a-zA-Z0-9_-]/g, "_");
    const dateStr = new Date().toISOString().split("T")[0];

    const wb = XLSX.utils.book_new();

    // Hoja 1: Resumen Ejecutivo
    const summaryRows: any[][] = [
        ["AUDITORÍA DE PRODUCTOS NO INVENTARIADOS (BAJAS EN 0)"],
        ["Sucursal:", branchName || "Sucursal"],
        ["Inventario:", inventoryTitle || "Inventario Nocturno"],
        ["Fecha de exportación:", new Date().toLocaleString("es-AR")],
        [],
        ["Métrica", "Valor"],
        ["SKUs en catálogo con stock > 0", audit.summary.totalCatalogWithStock],
        ["SKUs inventariados", audit.summary.countedCatalogSkus],
        ["SKUs NO inventariados (para baja en 0)", audit.summary.uncountedSkus],
        ["Cobertura de catálogo (%)", `${audit.summary.coveragePct}%`],
        ["Total unidades en sistema a dar de baja", audit.summary.totalUncountedUnits],
        ["Valorización total a Costo ($)", Number(audit.summary.totalUncountedCost.toFixed(2))],
        ["Valorización total a PVP ($)", Number(audit.summary.totalUncountedSale.toFixed(2))],
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary["!cols"] = [{ wch: 42 }, { wch: 28 }];
    if (wsSummary["A1"]) {
        wsSummary["A1"].s = { font: { bold: true, sz: 14, color: { rgb: "1E293B" } } };
    }
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen Auditoría");

    // Hoja 2: Detalle de Productos No Inventariados
    const header = [
        "IDProducto",
        "EAN",
        "Producto",
        "Laboratorio",
        "Rubro",
        "Stock Sistema",
        "Contado",
        "Diferencia",
        "Costo Unit.",
        "Total Baja Costo",
        "PVP Unit.",
        "Total Baja PVP",
    ];

    const detailRows = audit.items.map((it) => [
        it.idProducto,
        it.ean,
        it.name,
        it.laboratory,
        it.rubro,
        it.systemStock,
        0,
        it.diff,
        Number(it.cost.toFixed(2)),
        Number(it.totalCostLoss.toFixed(2)),
        Number(it.salePrice.toFixed(2)),
        Number(it.totalSaleLoss.toFixed(2)),
    ]);

    detailRows.push([
        "TOTALES",
        "",
        `${audit.items.length} productos`,
        "",
        "",
        audit.summary.totalUncountedUnits,
        0,
        -audit.summary.totalUncountedUnits,
        "",
        Number(audit.summary.totalUncountedCost.toFixed(2)),
        "",
        Number(audit.summary.totalUncountedSale.toFixed(2)),
    ]);

    const wsDetail = XLSX.utils.aoa_to_sheet([header, ...detailRows]);
    wsDetail["!cols"] = [
        { wch: 14 },
        { wch: 16 },
        { wch: 42 },
        { wch: 24 },
        { wch: 16 },
        { wch: 14 },
        { wch: 10 },
        { wch: 12 },
        { wch: 13 },
        { wch: 16 },
        { wch: 13 },
        { wch: 16 },
    ];

    for (let c = 0; c < header.length; c++) {
        const ref = XLSX.utils.encode_cell({ r: 0, c });
        if (wsDetail[ref]) {
            wsDetail[ref].s = {
                font: { bold: true, color: { rgb: "FFFFFF" } },
                fill: { fgColor: { rgb: "1E293B" } },
                alignment: { horizontal: "center" },
            };
        }
    }

    XLSX.utils.book_append_sheet(wb, wsDetail, "No Inventariados");
    XLSX.writeFile(wb, `Auditoria_No_Inventariados_${cleanBranch}_${dateStr}.xlsx`);
}

export function exportUncountedPlexTxt(
    audit: UncountedAuditResult,
    branchName: string
) {
    const cleanBranch = (branchName || "Sucursal").replace(/[^a-zA-Z0-9_-]/g, "_");
    const dateStr = new Date().toISOString().split("T")[0];

    // Formato Plex: IDPRODUCTO;EAN;CANTIDAD;UNIDADES -> en 0;0 para dar de baja
    const lines = audit.items.map((it) => `${it.idProducto || ""};${it.ean || ""};0;0`);
    const content = lines.join("\r\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Bajas_Plex_En_0_${cleanBranch}_${dateStr}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Respaldo offline: exporta todos los productos inventariados (cantidad > 0)
 * en formato .txt nativo de Plex: IDPRODUCTO;EAN;CANTIDAD;0
 */
export async function exportCountedPlexTxt(
    sessionId: string | undefined,
    countedItems: CountedItemRef[],
    branchName: string
): Promise<{ exportedCount: number; totalUnits: number }> {
    const cleanBranch = (branchName || "Sucursal").replace(/[^a-zA-Z0-9_-]/g, "_");
    const dateStr = new Date().toISOString().split("T")[0];

    const eanToId = new Map<string, string>();
    if (sessionId) {
        const [session, precountProducts] = await Promise.all([
            db.sessions.get(sessionId),
            db.precount_products.where("session_id").equals(sessionId).toArray(),
        ]);

        const masterCatalog = Array.isArray((session as any)?.master_catalog)
            ? (session as any).master_catalog
            : [];

        for (const p of [...precountProducts, ...masterCatalog]) {
            const idProd = String(p?.id_producto || "").trim();
            if (!idProd) continue;
            const ean = String(p?.ean || "").trim();
            if (ean && !eanToId.has(ean)) eanToId.set(ean, idProd);
            if (Array.isArray(p?.eans)) {
                for (const extra of p.eans) {
                    const cleanExtra = String(extra || "").trim();
                    if (cleanExtra && !eanToId.has(cleanExtra)) {
                        eanToId.set(cleanExtra, idProd);
                    }
                }
            }
        }
    }

    const aggregated = new Map<string, { idProducto: string; ean: string; qty: number }>();
    for (const item of countedItems) {
        const qty = Number(item.quantity || 0);
        if (qty <= 0) continue;

        const ean = String(item.ean || "").trim();
        if (!ean) continue;

        const rawId = String(item.id_producto || "").trim();
        const idProducto = rawId || eanToId.get(ean) || "";
        const key = idProducto || ean;

        const existing = aggregated.get(key);
        if (existing) {
            existing.qty += qty;
            if (!existing.idProducto && idProducto) existing.idProducto = idProducto;
        } else {
            aggregated.set(key, { idProducto, ean, qty });
        }
    }

    const rows = Array.from(aggregated.values());
    const lines = rows.map((r) => `${r.idProducto};${r.ean};${Math.round(r.qty)};0`);
    const totalUnits = rows.reduce((acc, r) => acc + Math.round(r.qty), 0);

    const blob = new Blob([lines.join("\r\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Inventario_Plex_${cleanBranch}_${dateStr}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { exportedCount: rows.length, totalUnits };
}
