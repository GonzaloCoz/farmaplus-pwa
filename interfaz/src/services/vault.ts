import { supabase } from '@/integrations/supabase/client';

let _token: string | null = null;

export async function getSessionToken(): Promise<string> {
    if (_token) return _token;

    try {
        const { data, error } = await (supabase as any).rpc('resolve_session_token');
        if (!error && data) {
            _token = String(data).trim();
            return _token;
        }
    } catch {
        // Silent fallback
    }

    return '';
}

export function resetSessionToken(): void {
    _token = null;
}
