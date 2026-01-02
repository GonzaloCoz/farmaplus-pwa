// Product cache for fast lookups
const productCache = new Map<string, { name: string; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function getCachedProduct(ean: string): string | null {
    const cached = productCache.get(ean);
    if (!cached) return null;

    // Check if cache is still valid
    if (Date.now() - cached.timestamp > CACHE_DURATION) {
        productCache.delete(ean);
        return null;
    }

    return cached.name;
}

export function cacheProduct(ean: string, name: string): void {
    productCache.set(ean, {
        name,
        timestamp: Date.now()
    });
}

export function clearProductCache(): void {
    productCache.clear();
}
