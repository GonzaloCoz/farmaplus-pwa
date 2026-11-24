/**
 * Shared resilience helpers for Supabase PostgREST queries, RPC retries,
 * batching, and connectivity wake-ups across service modules.
 */

export interface RetryOptions {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    shouldRetry?: (error: unknown) => boolean;
    label?: string;
}

/**
 * Returns true when browser/runtime reports connectivity (defaults true in SSR/Node).
 */
export function isNetworkOnline(): boolean {
    return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

/**
 * Normalizes unknown thrown values or Supabase PostgREST error objects into a readable message.
 */
export function getErrorMessage(error: unknown): string {
    if (!error) return 'Unknown error';
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    const anyErr = error as Record<string, any>;
    return String(anyErr.message || anyErr.error_description || anyErr.details || anyErr.hint || JSON.stringify(anyErr));
}

/**
 * Identifies database/schema constraint errors that will never succeed on retry.
 */
export function isPermanentDbError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const anyErr = error as Record<string, any>;
    const code = String(anyErr.code || '');
    // 23503: foreign_key_violation (e.g., session was deleted)
    // 22P02: invalid_text_representation (malformed UUID/type)
    // 23514: check_violation
    // 23502: not_null_violation
    // PGRST204: unknown column in schema
    return ['23503', '22P02', '23514', '23502', 'PGRST204'].includes(code);
}

/**
 * Returns true when an error is likely transient (network drop, timeout, 5xx, rate limit).
 */
export function isTransientError(error: unknown): boolean {
    if (isPermanentDbError(error)) return false;
    if (!error) return false;

    const anyErr = error as Record<string, any>;
    const status = Number(anyErr.status || anyErr.statusCode || 0);
    if ([0, 408, 425, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524].includes(status) && status !== 0) {
        return true;
    }

    const code = String(anyErr.code || '');
    if (['PGRST000', 'PGRST001', 'PGRST003', '08000', '08003', '08006', '57014', '40001', '40P01'].includes(code)) {
        return true;
    }

    const msg = getErrorMessage(error).toLowerCase();
    return (
        msg.includes('failed to fetch') ||
        msg.includes('network') ||
        msg.includes('load failed') ||
        msg.includes('timeout') ||
        msg.includes('timed out') ||
        msg.includes('econnreset') ||
        msg.includes('econnrefused') ||
        msg.includes('etimedout') ||
        msg.includes('abort') ||
        msg.includes('offline') ||
        msg.includes('fetch')
    );
}

/**
 * Computes capped exponential backoff with jitter to prevent thundering herds on reconnect.
 */
export function computeBackoffMs(retryCount: number, baseMs = 500, maxMs = 60000): number {
    const exp = Math.min(maxMs, baseMs * Math.pow(2, Math.max(0, retryCount)));
    const jitter = Math.floor(Math.random() * Math.min(1000, Math.max(100, exp * 0.25)));
    return Math.min(maxMs, exp + jitter);
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries an async operation with exponential backoff on transient failures.
 */
export async function withNetworkRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxAttempts = 3,
        baseDelayMs = 300,
        maxDelayMs = 4000,
        shouldRetry = (err) => isTransientError(err),
        label = 'operation',
    } = options;

    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (err) {
            lastError = err;
            const canRetry = attempt < maxAttempts && isNetworkOnline() && shouldRetry(err);
            if (!canRetry) {
                throw err;
            }
            const delay = computeBackoffMs(attempt - 1, baseDelayMs, maxDelayMs);
            console.warn(`[supabaseHelpers] ${label} attempt ${attempt}/${maxAttempts} failed (${getErrorMessage(err)}), retrying in ${delay}ms`);
            await sleep(delay);
        }
    }
    throw lastError;
}

/**
 * Fetches all rows from a PostgREST query, bypassing the default 1000-row cap.
 */
export async function fetchAllSupabasePages<T>(
    fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
    pageSize = 1000,
    label = 'paginated query'
): Promise<T[]> {
    const allRows: T[] = [];
    let from = 0;

    while (true) {
        const to = from + pageSize - 1;
        const page = await withNetworkRetry(async () => {
            const { data, error } = await fetchPage(from, to);
            if (error) throw error;
            return data || [];
        }, { maxAttempts: 3, label: `${label} [${from}-${to}]` });

        allRows.push(...page);
        if (page.length < pageSize) {
            break;
        }
        from += pageSize;
    }

    return allRows;
}

/**
 * Splits an array into fixed-size chunks for bounded Supabase batch writes.
 */
export function chunkArray<T>(items: readonly T[], chunkSize: number): T[][] {
    if (chunkSize <= 0) throw new Error('chunkSize must be positive');
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
        chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
}

/**
 * Subscribes to browser, visibility, focus, and Tauri lifecycle reconnect events.
 * Returns an unsubscribe cleanup callback.
 */
export function registerReconnectWakeup(onReconnect: () => void): () => void {
    if (typeof window === 'undefined') {
        return () => {};
    }

    let lastWakeupAt = 0;
    const trigger = (force = false) => {
        if (!isNetworkOnline()) return;
        const now = Date.now();
        if (!force && now - lastWakeupAt < 1500) return;
        lastWakeupAt = now;
        onReconnect();
    };

    const handleOnline = () => trigger(true);
    const handleVisibility = () => {
        if (typeof document === 'undefined' || document.visibilityState === 'visible') {
            trigger(false);
        }
    };
    const handleFocus = () => trigger(false);
    const handlePageShow = () => trigger(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handlePageShow);
    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', handleVisibility);
    }

    // Best-effort Tauri window/network wakeup hooks without hard module dependency
    let unlistenTauriFocus: (() => void) | undefined;
    let unlistenTauriNet: (() => void) | undefined;
    const tauriListen = (window as any).__TAURI__?.event?.listen;
    if (typeof tauriListen === 'function') {
        Promise.resolve(tauriListen('tauri://focus', () => trigger(false)))
            .then((fn: any) => {
                if (typeof fn === 'function') unlistenTauriFocus = fn;
            })
            .catch(() => {});
        Promise.resolve(tauriListen('network-status', (ev: any) => {
            if (ev?.payload?.online !== false) trigger(true);
        }))
            .then((fn: any) => {
                if (typeof fn === 'function') unlistenTauriNet = fn;
            })
            .catch(() => {});
    }

    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('pageshow', handlePageShow);
        if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', handleVisibility);
        }
        try {
            unlistenTauriFocus?.();
            unlistenTauriNet?.();
        } catch {
            // ignore cleanup errors
        }
    };
}
