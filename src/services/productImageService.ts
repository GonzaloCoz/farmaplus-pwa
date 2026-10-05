// Product Image Service - Farmaplus VTEX Integration
// Resolves official product packaging images on-demand by EAN

const memoryCache = new Map<string, string>();
const LOCAL_STORAGE_KEY = 'farmaplus_product_images_cache';

function getLocalCache(): Record<string, string> {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch {
        return {};
    }
}

function setLocalCache(ean: string, url: string) {
    try {
        memoryCache.set(ean, url);
        const cache = getLocalCache();
        cache[ean] = url;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cache));
    } catch {
        // Ignore quota errors
    }
}

function getApiBase(): string {
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        return '/api-farmaplus';
    }
    return 'https://www.farmaplus.com.ar';
}

export interface ProductLookupResult {
    ean: string;
    imageUrl: string | null;
    productName?: string;
    brand?: string;
}

export async function lookupProductByEan(ean: string): Promise<ProductLookupResult> {
    if (!ean || ean.trim().length === 0) {
        return { ean: '', imageUrl: null };
    }
    const cleanEan = ean.trim();

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(
            `${getApiBase()}/api/catalog_system/pub/products/search?fq=alternateIds_Ean:${cleanEan}`,
            { signal: controller.signal }
        );
        clearTimeout(timeout);

        if (res.ok) {
            const data = await res.json();
            const first = data?.[0];
            const imageUrl = first?.items?.[0]?.images?.[0]?.imageUrl || null;
            const cleanUrl = imageUrl ? imageUrl.replace(/^http:/, 'https:') : null;

            if (cleanUrl) {
                setLocalCache(cleanEan, cleanUrl);
            }

            return {
                ean: cleanEan,
                imageUrl: cleanUrl,
                productName: first?.productName || first?.items?.[0]?.name,
                brand: first?.brand
            };
        }
    } catch (err) {
        console.warn('Error fetching from Farmaplus VTEX API:', err);
    }

    return { ean: cleanEan, imageUrl: null };
}

export async function getProductImageUrl(ean: string): Promise<string | null> {
    if (!ean || ean.trim().length === 0) return null;
    const cleanEan = ean.trim();

    // 1. Memory Cache
    if (memoryCache.has(cleanEan)) {
        return memoryCache.get(cleanEan)!;
    }

    // 2. LocalStorage Cache
    const local = getLocalCache();
    if (local[cleanEan]) {
        memoryCache.set(cleanEan, local[cleanEan]);
        return local[cleanEan];
    }

    // 3. Fallback to pre-bundled local files (e.g. /products/{ean}.jpg)
    const localRelativePath = `/products/${cleanEan}.jpg`;

    // 4. Fetch from Farmaplus VTEX Public Catalog API
    const res = await lookupProductByEan(cleanEan);
    if (res.imageUrl) {
        return res.imageUrl;
    }

    return localRelativePath;
}

export async function prefetchProductImages(eans: string[]): Promise<void> {
    const uniqueEans = Array.from(new Set(eans.filter(Boolean)));
    const uncached = uniqueEans.filter((ean) => !memoryCache.has(ean) && !getLocalCache()[ean]);

    // Batch fetch in chunks of 4 parallel requests to prevent throttling
    const chunkSize = 4;
    for (let i = 0; i < uncached.length; i += chunkSize) {
        const chunk = uncached.slice(i, i + chunkSize);
        await Promise.allSettled(chunk.map((ean) => getProductImageUrl(ean)));
    }
}
