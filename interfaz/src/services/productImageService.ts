// Product Image Service - Supabase Storage (`product-images`) + Farmaplus VTEX fallback
// Resolves official product packaging images on-demand by EAN

const SUPABASE_BASE_URL = (import.meta.env.VITE_SUPABASE_URL || 'https://supabase.halu.com.ar').replace(/\/+$/, '');
const PRODUCT_IMAGES_BUCKET_URL = `${SUPABASE_BASE_URL}/storage/v1/object/public/product-images`;

const memoryCache = new Map<string, string>();
const inFlightLookups = new Map<string, Promise<string | null>>();
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

export function getSupabaseProductImageUrl(ean: string): string {
    const cleanEan = String(ean || '').trim();
    return `${PRODUCT_IMAGES_BUCKET_URL}/${encodeURIComponent(cleanEan)}.jpg`;
}

async function checkImageExists(url: string): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
        clearTimeout(timeout);
        return res.ok;
    } catch {
        return false;
    }
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

    // 1. Check Supabase Storage bucket first (fast, no CORS issues)
    const storageUrl = getSupabaseProductImageUrl(cleanEan);
    if (await checkImageExists(storageUrl)) {
        setLocalCache(cleanEan, storageUrl);
        return { ean: cleanEan, imageUrl: storageUrl };
    }

    // 2. Fallback to Farmaplus VTEX Public Catalog API
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

export async function getProductImageUrl(ean: string, relatedEans?: string[]): Promise<string | null> {
    const cleanEan = String(ean || '').trim();
    if (!cleanEan) return null;

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

    if (inFlightLookups.has(cleanEan)) {
        return inFlightLookups.get(cleanEan)!;
    }

    const promise = (async (): Promise<string | null> => {
        const candidates = Array.from(
            new Set([cleanEan, ...(relatedEans || [])].map((e) => String(e || '').trim()).filter(Boolean))
        );

        // 3. Try Supabase Storage bucket (`product-images/{ean}.jpg`) for primary and related EANs
        for (const candidate of candidates) {
            const storageUrl = getSupabaseProductImageUrl(candidate);
            if (await checkImageExists(storageUrl)) {
                setLocalCache(cleanEan, storageUrl);
                return storageUrl;
            }
        }

        // 4. Fallback to VTEX lookup
        const res = await lookupProductByEan(cleanEan);
        if (res.imageUrl) {
            return res.imageUrl;
        }

        // 5. Final fallback to pre-bundled local files
        return `/products/${cleanEan}.jpg`;
    })();

    inFlightLookups.set(cleanEan, promise);
    try {
        return await promise;
    } finally {
        inFlightLookups.delete(cleanEan);
    }
}

export async function prefetchProductImages(eans: string[]): Promise<void> {
    const uniqueEans = Array.from(new Set(eans.filter(Boolean)));
    const uncached = uniqueEans.filter((ean) => !memoryCache.has(ean) && !getLocalCache()[ean]);

    const chunkSize = 6;
    for (let i = 0; i < uncached.length; i += chunkSize) {
        const chunk = uncached.slice(i, i + chunkSize);
        await Promise.allSettled(chunk.map((ean) => getProductImageUrl(ean)));
    }
}
