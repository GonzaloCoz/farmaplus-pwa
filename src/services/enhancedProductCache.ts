/**
 * Enhanced Product Cache with IndexedDB
 * Provides persistent, fast caching with LRU eviction
 */

interface CachedProduct {
    ean: string;
    name: string;
    cost: number;
    salePrice: number;
    category?: string;
    laboratory?: string;
    stock: number;
    cachedAt: number;
    accessCount: number;
    lastAccessed: number;
}

const DB_NAME = 'farmaplus_cache';
const DB_VERSION = 1;
const STORE_NAME = 'products';
const MAX_CACHE_SIZE = 1000; // Maximum products in cache
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

class EnhancedProductCache {
    private db: IDBDatabase | null = null;
    private memoryCache: Map<string, CachedProduct> = new Map();
    private initPromise: Promise<void> | null = null;

    constructor() {
        this.initPromise = this.init();
    }

    private async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'ean' });
                    store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
                    store.createIndex('cachedAt', 'cachedAt', { unique: false });
                    store.createIndex('accessCount', 'accessCount', { unique: false });
                }
            };
        });
    }

    private async ensureInit(): Promise<void> {
        if (this.initPromise) {
            await this.initPromise;
        }
    }

    /**
     * Get product from cache (memory first, then IndexedDB)
     */
    async get(ean: string): Promise<CachedProduct | null> {
        await this.ensureInit();

        // Check memory cache first
        const memCached = this.memoryCache.get(ean);
        if (memCached && !this.isExpired(memCached)) {
            this.updateAccessStats(memCached);
            return memCached;
        }

        // Check IndexedDB
        if (!this.db) return null;

        return new Promise((resolve) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(ean);

            request.onsuccess = () => {
                const cached = request.result as CachedProduct | undefined;

                if (cached && !this.isExpired(cached)) {
                    // Update access stats and promote to memory cache
                    this.updateAccessStats(cached);
                    this.memoryCache.set(ean, cached);
                    resolve(cached);
                } else {
                    // Expired, remove it
                    if (cached) this.remove(ean);
                    resolve(null);
                }
            };

            request.onerror = () => resolve(null);
        });
    }

    /**
     * Set product in cache (both memory and IndexedDB)
     */
    async set(product: Omit<CachedProduct, 'cachedAt' | 'accessCount' | 'lastAccessed'>): Promise<void> {
        await this.ensureInit();

        const cached: CachedProduct = {
            ...product,
            cachedAt: Date.now(),
            accessCount: 1,
            lastAccessed: Date.now(),
        };

        // Add to memory cache
        this.memoryCache.set(product.ean, cached);

        // Add to IndexedDB
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(cached);

            request.onsuccess = () => {
                // Check cache size and evict if needed
                this.evictIfNeeded();
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Batch set multiple products
     */
    async setMany(products: Array<Omit<CachedProduct, 'cachedAt' | 'accessCount' | 'lastAccessed'>>): Promise<void> {
        await this.ensureInit();
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            const now = Date.now();
            products.forEach(product => {
                const cached: CachedProduct = {
                    ...product,
                    cachedAt: now,
                    accessCount: 1,
                    lastAccessed: now,
                };

                this.memoryCache.set(product.ean, cached);
                store.put(cached);
            });

            transaction.oncomplete = () => {
                this.evictIfNeeded();
                resolve();
            };
            transaction.onerror = () => reject(transaction.error);
        });
    }

    /**
     * Remove product from cache
     */
    async remove(ean: string): Promise<void> {
        await this.ensureInit();

        this.memoryCache.delete(ean);

        if (!this.db) return;

        return new Promise((resolve) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            store.delete(ean);
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => resolve(); // Ignore errors
        });
    }

    /**
     * Clear all cache
     */
    async clear(): Promise<void> {
        await this.ensureInit();

        this.memoryCache.clear();

        if (!this.db) return;

        return new Promise((resolve) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            store.clear();
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => resolve();
        });
    }

    /**
     * Get cache statistics
     */
    async getStats(): Promise<{ size: number; memorySize: number }> {
        await this.ensureInit();
        if (!this.db) return { size: 0, memorySize: this.memoryCache.size };

        return new Promise((resolve) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.count();

            request.onsuccess = () => {
                resolve({
                    size: request.result,
                    memorySize: this.memoryCache.size,
                });
            };
            request.onerror = () => resolve({ size: 0, memorySize: this.memoryCache.size });
        });
    }

    /**
     * Prefetch frequently used products
     */
    async prefetchFrequent(limit: number = 50): Promise<void> {
        await this.ensureInit();
        if (!this.db) return;

        return new Promise((resolve) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('accessCount');
            const request = index.openCursor(null, 'prev'); // Descending order

            let count = 0;
            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result;
                if (cursor && count < limit) {
                    const cached = cursor.value as CachedProduct;
                    if (!this.isExpired(cached)) {
                        this.memoryCache.set(cached.ean, cached);
                        count++;
                    }
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            request.onerror = () => resolve();
        });
    }

    // Private helper methods

    private isExpired(cached: CachedProduct): boolean {
        return Date.now() - cached.cachedAt > CACHE_TTL;
    }

    private updateAccessStats(cached: CachedProduct): void {
        cached.accessCount++;
        cached.lastAccessed = Date.now();

        // Async update in IndexedDB (fire and forget)
        if (this.db) {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            store.put(cached);
        }
    }

    private async evictIfNeeded(): Promise<void> {
        if (!this.db) return;

        const stats = await this.getStats();
        if (stats.size <= MAX_CACHE_SIZE) return;

        // Evict least recently used items
        const toEvict = stats.size - MAX_CACHE_SIZE + 50; // Evict extra to avoid frequent evictions

        return new Promise((resolve) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('lastAccessed');
            const request = index.openCursor(null, 'next'); // Ascending order (oldest first)

            let evicted = 0;
            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result;
                if (cursor && evicted < toEvict) {
                    const cached = cursor.value as CachedProduct;
                    this.memoryCache.delete(cached.ean);
                    cursor.delete();
                    evicted++;
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            request.onerror = () => resolve();
        });
    }
}

// Singleton instance
export const enhancedProductCache = new EnhancedProductCache();

// Helper functions for backward compatibility
export async function getCachedProduct(ean: string): Promise<string | null> {
    const cached = await enhancedProductCache.get(ean);
    return cached?.name || null;
}

export async function cacheProduct(ean: string, name: string): Promise<void> {
    await enhancedProductCache.set({
        ean,
        name,
        cost: 0,
        salePrice: 0,
        stock: 0,
    });
}

export async function cacheProducts(products: Array<{ ean: string; name: string; cost?: number; salePrice?: number; stock?: number }>): Promise<void> {
    await enhancedProductCache.setMany(
        products.map(p => ({
            ean: p.ean,
            name: p.name,
            cost: p.cost || 0,
            salePrice: p.salePrice || 0,
            stock: p.stock || 0,
        }))
    );
}

export async function clearProductCache(): Promise<void> {
    await enhancedProductCache.clear();
}

export async function prefetchFrequentProducts(): Promise<void> {
    await enhancedProductCache.prefetchFrequent(100);
}
