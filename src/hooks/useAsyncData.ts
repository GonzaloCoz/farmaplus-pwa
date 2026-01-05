import { useState, useEffect, useCallback } from 'react';

interface UseAsyncDataOptions<T> {
    initialData?: T;
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
}

interface UseAsyncDataReturn<T> {
    data: T | null;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
}

/**
 * Hook personalizado para manejar llamadas asíncronas con estados de loading, error y data
 * @param fetchFn - Función que retorna una Promise con los datos
 * @param deps - Dependencias que disparan re-fetch
 * @param options - Opciones adicionales (initialData, callbacks)
 * @returns Objeto con data, isLoading, error y función refetch
 * 
 * @example
 * const { data, isLoading, error, refetch } = useAsyncData(
 *   async () => await fetchReports(),
 *   [branchId],
 *   { onSuccess: (data) => console.log('Loaded:', data) }
 * );
 */
export function useAsyncData<T>(
    fetchFn: () => Promise<T>,
    deps: React.DependencyList = [],
    options: UseAsyncDataOptions<T> = {}
): UseAsyncDataReturn<T> {
    const [data, setData] = useState<T | null>(options.initialData ?? null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchData = useCallback(async () => {
        let cancelled = false;
        setIsLoading(true);
        setError(null);

        try {
            const result = await fetchFn();
            if (!cancelled) {
                setData(result);
                options.onSuccess?.(result);
            }
        } catch (err) {
            if (!cancelled) {
                const error = err instanceof Error ? err : new Error(String(err));
                setError(error);
                options.onError?.(error);
            }
        } finally {
            if (!cancelled) {
                setIsLoading(false);
            }
        }
    }, deps);

    useEffect(() => {
        fetchData();
        return () => {
            // Cleanup flag would go here if needed
        };
    }, [fetchData]);

    return { data, isLoading, error, refetch: fetchData };
}
