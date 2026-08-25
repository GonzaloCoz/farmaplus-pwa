import { MasterCatalogItem } from './preCountDB';

export interface PlexProduct {
    idproducto: string;
    producto: string;
    stock: number;
    codebars: string[];
}

export interface PlexFetchResult {
    success: boolean;
    message: string;
    total_products: number;
    total_codebars: number;
    products: PlexProduct[];
    logs: string[];
}

export interface PlexExportRecord {
    idproducto: string;
    codebar: string;
    cantidad: number;
}

/**
 * Detect if running inside Tauri native runtime
 */
export function isTauriEnvironment(): boolean {
    return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

/**
 * Test TCP Socket connection to Plex server (Port 3144 by default)
 */
export async function testPlexConnection(host: string, port: number = 3144): Promise<{ success: boolean; message: string }> {
    if (!isTauriEnvironment()) {
        return {
            success: false,
            message: 'Esta función requiere ejecutar Farmaplus en modo de escritorio (Tauri) para acceder a Sockets TCP.'
        };
    }

    try {
        const { invoke } = await import('@tauri-apps/api/core');
        const res = await invoke<string>('test_plex_connection', { host, port });
        return { success: true, message: res };
    } catch (err: any) {
        return { success: false, message: err?.toString() || 'Error al conectar con el servidor Plex' };
    }
}

/**
 * Fetch full product stock catalog directly from Plex TCP server
 */
export async function fetchPlexStockDirect(
    host: string,
    port: number = 3144,
    onLog?: (log: string) => void
): Promise<PlexFetchResult> {
    if (!isTauriEnvironment()) {
        throw new Error('La importación directa por TCP requiere la app de escritorio Tauri en Windows.');
    }

    onLog?.(`[TCP] Conectando a Plex en ${host}:${port}...`);
    const { invoke } = await import('@tauri-apps/api/core');

    const result = await invoke<PlexFetchResult>('fetch_plex_stock', { host, port });

    if (result.logs && onLog) {
        result.logs.forEach(l => onLog(l));
    }

    return result;
}

/**
 * Export counted inventory back to Plex TCP server
 */
export async function exportInventoryToPlexDirect(
    host: string,
    port: number = 3144,
    records: PlexExportRecord[]
): Promise<string> {
    if (!isTauriEnvironment()) {
        throw new Error('La exportación directa requiere Tauri de escritorio.');
    }

    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<string>('export_plex_inventory', { host, port, records });
}

/**
 * Converts Plex products into Farmaplus MasterCatalogItems (mapping primary and secondary EANs)
 */
export function convertPlexToMasterCatalog(products: PlexProduct[]): MasterCatalogItem[] {
    const catalog: MasterCatalogItem[] = [];

    for (const p of products) {
        const primaryEan = (p.codebars && p.codebars.length > 0) ? p.codebars[0] : p.idproducto;
        const allEans = p.codebars && p.codebars.length > 0 ? p.codebars : [primaryEan];

        // 1. Entrada Principal
        catalog.push({
            ean: primaryEan,
            eans: allEans,
            isPrimaryEan: true,
            id_producto: p.idproducto,
            name: p.producto,
            systemStock: p.stock,
            cost: 0,
            salePrice: 0,
        });

        // 2. Entradas Secundarias para cada código de barra adicional
        for (let i = 1; i < allEans.length; i++) {
            const secondaryEan = allEans[i];
            if (secondaryEan && secondaryEan !== primaryEan) {
                catalog.push({
                    ean: secondaryEan,
                    eans: allEans,
                    isPrimaryEan: false,
                    id_producto: p.idproducto,
                    name: p.producto,
                    systemStock: p.stock,
                    cost: 0,
                    salePrice: 0,
                });
            }
        }
    }

    return catalog;
}
