import { supabase } from '@/integrations/supabase/client';
import { executeMysqlRawQuery, MysqlConfig } from './mysqlTauriBridge';
import { resolveBranchConfig } from './mysqlTauriBridge';
import { normalizeString } from '@/lib/utils';

export interface ForensicLabRecord {
    plex_lab_id: number;
    laboratory: string;
    category: 'MEDICAMENTOS' | 'ACCESORIOS' | 'PERFUMERIA' | 'VARIOS';
    state: 'active' | 'stockout' | 'hibernated';
    stock_skus: number;
    stock_units: number;
    sales_units_90d: number;
    sales_skus_90d: number;
    movements_count_90d: number;
}

export interface ForensicAuditSummary {
    branchSlug: string;
    totalAudited: number;
    activeCount: number;
    stockoutCount: number;
    hibernatedCount: number;
    elapsedMs: number;
}

const RUBRO_MAP: Record<number, 'MEDICAMENTOS' | 'ACCESORIOS' | 'PERFUMERIA' | 'VARIOS'> = {
    1: 'MEDICAMENTOS',
    2: 'ACCESORIOS',
    3: 'PERFUMERIA',
    4: 'VARIOS'
};

/**
 * Micro-Engine Forense: Audita stock, ventas y movimientos de Plex en <500ms
 * y clasifica laboratorios en:
 * - 'active'     (Stock > 0)
 * - 'stockout'   (Stock = 0, pero con ventas o remitos en últimos 90 días)
 * - 'hibernated' (Stock = 0 y CERO ventas/remitos en 90 días -> excluido de la meta)
 */
export async function auditBranchPlexLabs(
    branchNameOrId: string | number,
    daysCutoff: number = 90
): Promise<ForensicLabRecord[]> {
    const { config, branchId } = await resolveBranchConfig(String(branchNameOrId));
    const cutoffDate = new Date(Date.now() - daysCutoff * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // 0. Maestro de nombres de laboratorios
    const labsQuery = `SELECT IDLaboratorio, Nombre FROM laboratorios`;
    const labsRes = await executeMysqlRawQuery(config, labsQuery, 10000);
    const labNames = new Map<number, string>();
    for (const row of labsRes.rows) {
        const id = Number(row[0]);
        const name = String(row[1] || '').trim();
        if (id && name) labNames.set(id, name);
    }

    const records = new Map<string, ForensicLabRecord>();

    const getEntry = (labId: number, rubroId: number): ForensicLabRecord => {
        const cat = RUBRO_MAP[rubroId] || 'VARIOS';
        const key = `${labId}_${cat}`;
        if (!records.has(key)) {
            const rawName = labNames.get(labId) || `LAB_${labId}`;
            records.set(key, {
                plex_lab_id: labId,
                laboratory: rawName,
                category: cat,
                state: 'hibernated',
                stock_skus: 0,
                stock_units: 0,
                sales_units_90d: 0,
                sales_skus_90d: 0,
                movements_count_90d: 0
            });
        }
        return records.get(key)!;
    };

    // 1. Peritaje de Stock Actual (>0)
    const stockQuery = `
        SELECT p.IDLaboratorio, p.IDRubro, COUNT(DISTINCT p.IDProducto), SUM(s.Cantidad)
        FROM stock s
        JOIN productos p ON s.IDProducto = p.IDProducto
        WHERE s.Cantidad > 0
        GROUP BY p.IDLaboratorio, p.IDRubro
    `;
    const stockRes = await executeMysqlRawQuery(config, stockQuery, 10000);
    for (const r of stockRes.rows) {
        const labId = Number(r[0]);
        const rubroId = Number(r[1]);
        if (!labId) continue;
        const e = getEntry(labId, rubroId);
        e.stock_skus = Number(r[2]) || 0;
        e.stock_units = Number(r[3]) || 0;
    }

    // 2. Peritaje de Ventas Recientes (index-driven via factcabecera.Emision)
    // Filtramos por fc.Sucursal si está disponible para evitar sumar ventas de otras sucursales en bases consolidadas
    const branchFilter = branchId > 0 
        ? `AND (fc.Sucursal = ${branchId})` 
        : '';

    const salesQuery = `
        SELECT p.IDLaboratorio, p.IDRubro, COUNT(DISTINCT fl.IDProducto), SUM(fl.Cantidad)
        FROM factcabecera fc
        JOIN factlineas fl ON fc.IDComprobante = fl.IDComprobante
        JOIN productos p ON fl.IDProducto = p.IDProducto
        WHERE fc.Emision >= '${cutoffDate}' ${branchFilter}
        GROUP BY p.IDLaboratorio, p.IDRubro
    `;
    const salesRes = await executeMysqlRawQuery(config, salesQuery, 10000);
    for (const r of salesRes.rows) {
        const labId = Number(r[0]);
        const rubroId = Number(r[1]);
        if (!labId) continue;
        const e = getEntry(labId, rubroId);
        e.sales_skus_90d = Number(r[2]) || 0;
        e.sales_units_90d = Number(r[3]) || 0;
    }

    // 3. Peritaje de Movimientos y Remitos (stockmovimientos.Fecha)
    const movsQuery = `
        SELECT p.IDLaboratorio, p.IDRubro, COUNT(*)
        FROM stockmovimientos sm
        JOIN productos p ON sm.IDProducto = p.IDProducto
        WHERE sm.Fecha >= '${cutoffDate}'
        GROUP BY p.IDLaboratorio, p.IDRubro
    `;
    const movsRes = await executeMysqlRawQuery(config, movsQuery, 10000);
    for (const r of movsRes.rows) {
        const labId = Number(r[0]);
        const rubroId = Number(r[1]);
        if (!labId) continue;
        const e = getEntry(labId, rubroId);
        e.movements_count_90d = Number(r[2]) || 0;
    }

    // 4. Clasificación Dinámica
    for (const record of records.values()) {
        if (record.stock_units > 0) {
            record.state = 'active';
        } else if (record.sales_units_90d > 0 || record.movements_count_90d > 0) {
            record.state = 'stockout';
        } else {
            record.state = 'hibernated';
        }
    }

    return Array.from(records.values());
}

/**
 * Sincroniza los resultados del peritaje a cyclic_labs en Supabase
 */
export async function syncForensicAuditToSupabase(
    branchSlug: string,
    records: ForensicLabRecord[]
): Promise<ForensicAuditSummary> {
    const t0 = Date.now();
    const cleanSlug = normalizeString(branchSlug).toLowerCase();

    // Obtener branch_id de Supabase
    const { data: bData } = await supabase
        .from('branches')
        .select('id, name')
        .or(`slug.eq.${cleanSlug},name.ilike.%${cleanSlug}%`)
        .maybeSingle();

    const branchId = bData?.id || null;

    // Obtener la ronda activa de la sucursal (default 1)
    let activeRound = 1;
    const { data: configData } = await supabase
        .from('inventories')
        .select('quantity')
        .ilike('branch_name', cleanSlug)
        .eq('laboratory', '_CONFIG_')
        .eq('ean', 'CONFIG_ROUND')
        .maybeSingle();

    if (configData?.quantity) {
        activeRound = Number(configData.quantity);
    }

    // Mapear filas para UPSERT
    const rows = records.map(r => ({
        branch_id: branchId,
        branch_slug: cleanSlug,
        plex_lab_id: r.plex_lab_id,
        laboratory: r.laboratory,
        category: r.category,
        state: r.state,
        total_items: r.stock_skus,
        round: activeRound,
        updated_at: new Date().toISOString()
    }));

    // Upsert por lotes de 100
    const chunkSize = 100;
    for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error } = await (supabase.from('cyclic_labs') as any).upsert(chunk, {
            onConflict: 'branch_slug,plex_lab_id,category,round'
        });
        if (error) {
            console.error('[CyclicEngine] Error en upsert batch:', error);
        }
    }

    const activeCount = records.filter(r => r.state === 'active').length;
    const stockoutCount = records.filter(r => r.state === 'stockout').length;
    const hibernatedCount = records.filter(r => r.state === 'hibernated').length;

    return {
        branchSlug: cleanSlug,
        totalAudited: records.length,
        activeCount,
        stockoutCount,
        hibernatedCount,
        elapsedMs: Date.now() - t0
    };
}

/**
 * Ejecuta el ciclo completo de auditoría y sincronización silenciosa
 */
export async function runForensicAudit(
    branchNameOrId: string | number
): Promise<ForensicAuditSummary> {
    const records = await auditBranchPlexLabs(branchNameOrId);
    const branchSlug = typeof branchNameOrId === 'number'
        ? String(branchNameOrId)
        : normalizeString(branchNameOrId);

    const summary = await syncForensicAuditToSupabase(branchSlug, records);
    localStorage.setItem(`cyclic_last_audit_${branchSlug}`, new Date().toISOString().split('T')[0]);
    return summary;
}
