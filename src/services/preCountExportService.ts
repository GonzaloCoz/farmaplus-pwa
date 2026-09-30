import { supabase } from '@/integrations/supabase/client';
import { normalizeString } from '@/lib/utils';
import { db, LocalItem } from '@/services/db';
import { getDeviceId, getDeviceName } from '@/services/deviceTelemetry';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';

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
                const idProd = item.id_producto || '';
                return `${idProd};${item.ean};${item.quantity};0`;
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

        const deviceId = getDeviceId();
        const devName = userName || getDeviceName() || 'Terminal';
        const cleanBranch = normalizeString(branchName || 'Sucursal');
        const cleanSector = (sectorOrLab || 'General').replace(/[^a-zA-Z0-9_-]/g, '_');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `CONTEO_${cleanBranch}_${cleanSector}_${timestamp}.txt`;

        // 1. Generar contenido estándar TXT
        const lines = items.map(item => {
            const idProd = item.id_producto || '';
            return `${idProd};${item.ean};${item.quantity};0`;
        });
        const fileContent = lines.join('\n');

        const totalUnits = items.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0);
        const totalSkus = new Set(items.map(it => it.ean)).size;

        // 2. Persistir directamente los productos en precount_items para la tabla maestra del Admin
        if (sessionId) {
            try {
                const itemsToUpsert = items.map(item => ({
                    id: item.id || uuidv4(),
                    session_id: sessionId,
                    ean: item.ean,
                    id_producto: item.id_producto || null,
                    product_name: item.productName || `Producto ${item.ean}`,
                    quantity: Number(item.quantity) || 1,
                    scanned_at: new Date().toISOString(),
                    device_id: deviceId,
                    device_name: devName,
                    location_tag: item.sector || sectorOrLab || 'General'
                }));

                // Enviar en bloques de 100
                for (let i = 0; i < itemsToUpsert.length; i += 100) {
                    const chunk = itemsToUpsert.slice(i, i + 100);
                    const { error: upsertErr } = await (supabase as any)
                        .from('precount_items')
                        .upsert(chunk, { onConflict: 'id' });
                    if (upsertErr) {
                        console.warn('[preCountExportService] Error en upsert de precount_items:', upsertErr);
                    }
                }
                console.log(`[preCountExportService] ${itemsToUpsert.length} items sincronizados a precount_items (${devName})`);
            } catch (upsertEx) {
                console.error('[preCountExportService] Error sincronizando a precount_items:', upsertEx);
            }

            // Subir archivo de respaldo a precount_device_files
            try {
                await (supabase as any)
                    .from('precount_device_files')
                    .insert({
                        session_id: sessionId,
                        device_id: deviceId,
                        device_name: devName,
                        filename: fileName,
                        content: fileContent
                    });
            } catch (fErr) {
                console.warn('[preCountExportService] Error guardando en precount_device_files:', fErr);
            }
        }

        // 3. Persistir en la tabla de auditoría / batches / notificaciones de Supabase
        try {
            // Registrar auditoría de envío para que el admin lo reciba
            await supabase.from('audit_logs').insert({
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
            });

            // 3. Crear notificación para administradores
            await supabase.from('notifications').insert({
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
            });

            // 4. Si la sesión está activa en Dexie, marcar ítems como sincronizados
            if (sessionId) {
                try {
                    await db.items.where('session_id').equals(sessionId).modify({ synced: 1 });
                } catch {}
            }

            // 5. Descargar automáticamente el archivo .txt local de respaldo
            preCountExportService.downloadLocalTxt(fileName, items);

            // 6. Notificar a otros componentes locales
            window.dispatchEvent(new CustomEvent('precount:batch_sent', {
                detail: { fileName, totalUnits, totalSkus, sectorOrLab }
            }));

            return { success: true, fileName };
        } catch (err: any) {
            console.error('[ExportService] Error al enviar lote a Supabase:', err);
            // Si falla la red, al menos garantizar la descarga del archivo local
            preCountExportService.downloadLocalTxt(fileName, items);
            throw err;
        }
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
