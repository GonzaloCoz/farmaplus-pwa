import { supabase } from '@/integrations/supabase/client';
import { normalizeString } from '@/lib/utils';
import { db } from '@/services/db';
import { getDeviceId, getDeviceName } from '@/services/deviceTelemetry';
import { syncManager } from '@/services/syncManager';
import { chunkArray, isNetworkOnline, withNetworkRetry } from '@/services/supabaseHelpers';

export interface SendBatchPayload {
    branchName: string;
    inventoryTitle: string;
    sectorOrLab: string;
    items: Array<{
        id?: string;
        id_producto?: string;
        ean: string;
        productName?: string;
        quantity: number;
        cost?: number;
        laboratory?: string;
        rubro?: string;
        sector?: string;
    }>;
    sessionId?: string;
    userName?: string;
}

export interface SentBatchRecord {
    id: string;
    created_at: string;
    branch_name: string;
    inventory_title: string;
    sector: string;
    device_id: string;
    device_name: string;
    total_units: number;
    total_skus: number;
    file_name: string;
    content: string;
    status: 'received' | 'processed' | 'archived';
}

export const preCountExportService = {
    /**
     * Genera el archivo .txt de colector estándar Farmaplus y lo descarga localmente
     */
    downloadLocalTxt: (
        fileName: string, 
        items: Array<{ id_producto?: string; ean: string; quantity: number }>
    ) => {
        try {
            const lines = items.map(item => {
                let idProd = (item.id_producto || '').trim();
                const rawEan = (item.ean || '').trim();
                if (!idProd) {
                    idProd = rawEan;
                }
                return `${idProd};${rawEan};${item.quantity};0`;
            });
            const content = lines.join('\n');

            const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            return content;
        } catch (err) {
            console.error('[ExportService] Error descargando archivo local:', err);
            return null;
        }
    },

    /**
     * Envía los productos contados al Administrador mediante Supabase
     */
    sendBatchToAdmin: async (payload: SendBatchPayload): Promise<{ success: boolean; fileName: string }> => {
        const { branchName, inventoryTitle, sectorOrLab, items, sessionId, userName } = payload;
        
        if (!items || items.length === 0) {
            throw new Error('No hay productos para exportar.');
        }

        // Resolver id_producto para los ítems que no lo tengan
        if (sessionId) {
            try {
                const catalogItems = await db.precount_products.where('session_id').equals(sessionId).toArray();
                const catMap = new Map<string, string>();
                catalogItems.forEach(p => {
                    const idp = String(p.id_producto || '').trim();
                    const ean = String(p.ean || '').trim();
                    if (idp) {
                        if (ean) catMap.set(ean, idp);
                        catMap.set(idp, idp);
                    }
                });

                items.forEach(it => {
                    let idp = (it.id_producto || '').trim();
                    const rawEan = (it.ean || '').trim();
                    if (!idp && rawEan) {
                        idp = catMap.get(rawEan) || '';
                    }
                    if (!idp && rawEan) {
                        idp = rawEan;
                    }
                    it.id_producto = idp;
                });
            } catch {}
        } else {
            items.forEach(it => {
                if (!it.id_producto && it.ean) {
                    it.id_producto = it.ean;
                }
            });
        }

        const deviceId = getDeviceId();
        const devName = userName || getDeviceName() || 'Terminal';
        const cleanBranch = normalizeString(branchName || 'Sucursal');
        const cleanSector = (sectorOrLab || 'General').replace(/[^a-zA-Z0-9_-]/g, '_');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `CONTEO_${cleanBranch}_${cleanSector}_${timestamp}.txt`;

        // 1. Generar contenido estándar TXT
        const lines = items.map(item => {
            const idProd = (item.id_producto || item.ean || '').trim();
            return `${idProd};${item.ean};${item.quantity};0`;
        });
        const fileContent = lines.join('\n');

        const totalUnits = items.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0);
        const totalSkus = new Set(items.map(it => it.ean)).size;

        const itemsToUpsert = sessionId
            ? items.map(item => ({
                id: item.id || crypto.randomUUID(),
                session_id: sessionId,
                ean: item.ean,
                id_producto: item.id_producto || null,
                product_name: item.productName || `Producto ${item.ean}`,
                quantity: Number(item.quantity) || 1,
                scanned_at: new Date().toISOString(),
                device_id: deviceId,
                device_name: devName,
                location_tag: item.sector || sectorOrLab || 'General'
            }))
            : [];

        const deviceFileRow = sessionId
            ? {
                session_id: sessionId,
                device_id: deviceId,
                device_name: devName,
                filename: fileName,
                content: fileContent
            }
            : undefined;

        const auditLogPayload = {
            action: 'PRECOUNT_BATCH_SUBMITTED',
            entity_type: 'precount_batch',
            branch_id: cleanBranch,
            details: {
                file_name: fileName,
                inventory_title: inventoryTitle,
                sector: sectorOrLab,
                branch_name: branchName,
                device_id: deviceId,
                device_name: devName,
                total_units: totalUnits,
                total_skus: totalSkus,
                content: fileContent,
                session_id: sessionId,
                sent_at: new Date().toISOString(),
                items_sample: items.slice(0, 50).map(i => ({
                    ean: i.ean,
                    qty: i.quantity,
                    name: i.productName || ''
                }))
            }
        };

        const notificationPayload = {
            user_id: 'admin_broadcast',
            type: 'inventory_batch',
            category: 'precount',
            title: `Lote Recibido - ${branchName}`,
            message: `Se enviaron ${totalUnits} un. (${totalSkus} SKUs) correspondientes a "${inventoryTitle}" (${sectorOrLab})`,
            is_read: false,
            metadata: {
                file_name: fileName,
                branch_name: branchName,
                sector: sectorOrLab,
                total_units: totalUnits,
                total_skus: totalSkus,
                device_id: deviceId
            }
        };

        // 2. Respaldo .txt local inmediato
        preCountExportService.downloadLocalTxt(fileName, items);

        // Si está offline, encolar el lote completo en IndexedDB para envío automático al reconectar
        if (!isNetworkOnline()) {
            await syncManager.addToQueue({
                type: 'create',
                entity: 'batch_export',
                data: {
                    sessionId,
                    fileName,
                    itemsToUpsert,
                    deviceFileRow,
                    auditLogPayload,
                    notificationPayload
                }
            }, { skipFlush: true });

            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('precount:batch_sent', {
                    detail: { fileName, totalUnits, totalSkus, sectorOrLab, queuedOffline: true }
                }));
            }
            return { success: true, fileName };
        }

        // 3. Envío online verificando errores en cada tabla y encolando cualquier parte fallida
        let itemsFailed = false;
        let deviceFileFailed = false;
        let auditFailed = false;
        let notificationFailed = false;

        if (sessionId && itemsToUpsert.length > 0) {
            try {
                for (const chunk of chunkArray(itemsToUpsert, 100)) {
                    await withNetworkRetry(async () => {
                        const { error: upsertErr } = await (supabase as any)
                            .from('precount_items')
                            .upsert(chunk, { onConflict: 'id' });
                        if (upsertErr) throw upsertErr;
                    }, { maxAttempts: 2, label: 'sendBatchToAdmin:items' });
                }
                await db.items.where('session_id').equals(sessionId).modify({ synced: 1 }).catch(() => {});
            } catch (upsertEx) {
                itemsFailed = true;
                console.error('[preCountExportService] Error sincronizando a precount_items (encolado para reintento):', upsertEx);
            }
        }

        if (deviceFileRow) {
            try {
                await withNetworkRetry(async () => {
                    const { error: delErr } = await (supabase as any)
                        .from('precount_device_files')
                        .delete()
                        .eq('session_id', sessionId)
                        .eq('filename', fileName);
                    if (delErr) throw delErr;
                    const { error: insErr } = await (supabase as any)
                        .from('precount_device_files')
                        .insert(deviceFileRow);
                    if (insErr) throw insErr;
                }, { maxAttempts: 2, label: 'sendBatchToAdmin:device_file' });
            } catch (fErr) {
                deviceFileFailed = true;
                console.warn('[preCountExportService] Error guardando en precount_device_files (encolado):', fErr);
            }
        }

        try {
            const { error: auditErr } = await supabase.from('audit_logs').insert(auditLogPayload);
            if (auditErr) throw auditErr;
        } catch (auditEx) {
            auditFailed = true;
            console.warn('[preCountExportService] Error guardando audit_logs (encolado):', auditEx);
        }

        try {
            const { error: notifErr } = await supabase.from('notifications').insert(notificationPayload);
            if (notifErr) throw notifErr;
        } catch (notifEx) {
            notificationFailed = true;
            console.warn('[preCountExportService] Error guardando notifications (encolado):', notifEx);
        }

        if (itemsFailed || deviceFileFailed || auditFailed || notificationFailed) {
            await syncManager.addToQueue({
                type: 'create',
                entity: 'batch_export',
                data: {
                    sessionId,
                    fileName,
                    itemsToUpsert: itemsFailed ? itemsToUpsert : [],
                    deviceFileRow: deviceFileFailed ? deviceFileRow : undefined,
                    auditLogPayload: auditFailed ? auditLogPayload : undefined,
                    notificationPayload: notificationFailed ? notificationPayload : undefined
                }
            });
        }

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('precount:batch_sent', {
                detail: {
                    fileName,
                    totalUnits,
                    totalSkus,
                    sectorOrLab,
                    queuedOffline: itemsFailed || deviceFileFailed || auditFailed || notificationFailed
                }
            }));
        }

        return { success: true, fileName };
    },

    /**
     * Obtiene los lotes enviados recibidos desde Supabase para el panel de Administrador
     */
    fetchAdminSentBatches: async (): Promise<SentBatchRecord[]> => {
        try {
            const { data, error } = await supabase
                .from('audit_logs')
                .select('*')
                .eq('action', 'PRECOUNT_BATCH_SUBMITTED')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error || !data) {
                return [];
            }

            return data.map((log: any) => {
                const details = log.details || {};
                return {
                    id: log.id,
                    created_at: log.created_at,
                    branch_name: details.branch_name || log.branch_id || 'Sucursal',
                    inventory_title: details.inventory_title || 'Inventario',
                    sector: details.sector || 'General',
                    device_id: details.device_id || 'DEV-01',
                    device_name: details.device_name || 'Terminal',
                    total_units: details.total_units || 0,
                    total_skus: details.total_skus || 0,
                    file_name: details.file_name || `LOTE_${log.id.substring(0, 8)}.txt`,
                    content: details.content || '',
                    status: 'received'
                };
            });
        } catch (err) {
            console.error('[ExportService] Error fetching admin batches:', err);
            return [];
        }
    }
};
