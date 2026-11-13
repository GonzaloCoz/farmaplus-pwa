/**
 * Utilitario de compresión y descompresión Gzip para payloads grandes (catálogos de stock).
 * Usa APIs nativas del navegador (CompressionStream, DecompressionStream, FileReader, fetch).
 * Compatible con Android Zebra (GZIPInputStream / Base64).
 */

export async function compressJsonToGzipBase64(data: any): Promise<string> {
    try {
        const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
        if (typeof CompressionStream !== 'undefined') {
            const stream = new Blob([jsonStr]).stream().pipeThrough(new CompressionStream('gzip'));
            const compressedBlob = await new Response(stream).blob();
            const base64 = await blobToBase64(compressedBlob);
            return 'gzip:' + base64;
        }
        return jsonStr;
    } catch (err) {
        console.warn('[Compression] Falló compresión Gzip nativa, usando JSON plano:', err);
        return typeof data === 'string' ? data : JSON.stringify(data);
    }
}

export async function decompressGzipBase64ToJson<T = any>(content: string): Promise<T> {
    const trimmed = (content || '').trim();
    if (!trimmed) return [] as unknown as T;

    if (trimmed.startsWith('gzip:') || trimmed.startsWith('H4sI')) {
        try {
            const b64 = trimmed.startsWith('gzip:') ? trimmed.substring(5) : trimmed;
            if (typeof DecompressionStream !== 'undefined') {
                const res = await fetch(`data:application/octet-stream;base64,${b64}`);
                const blob = await res.blob();
                const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
                const text = await new Response(stream).text();
                return JSON.parse(text);
            }
        } catch (err) {
            console.error('[Compression] Error al descomprimir Gzip base64:', err);
            throw err;
        }
    }

    return JSON.parse(trimmed);
}

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result as string;
            const commaIndex = dataUrl.indexOf(',');
            resolve(commaIndex !== -1 ? dataUrl.substring(commaIndex + 1) : dataUrl);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
