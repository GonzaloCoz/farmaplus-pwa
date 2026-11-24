
import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

export interface AppVersion {
    id: string;
    version: string;
    release_notes: string | null;
    is_active: boolean;
    published_at: string;
}

interface AppVersionState {
    currentVersion: string;
    latestVersion: AppVersion | null;
    isUpdateAvailable: boolean;
    isChecking: boolean;

    // Actions
    checkForUpdates: () => Promise<void>;
    setupRealtimeSubscription: () => void;
    cleanupSubscription: () => void;
}

// Current hardcoded version of the app
export const CURRENT_APP_VERSION = 'v1.2.x (Build 2026.05.18)';

// Make the state globally reactive
export const useAppVersion = create<AppVersionState>((set, get) => {
    let subscription: ReturnType<typeof supabase.channel> | null = null;

    return {
        currentVersion: CURRENT_APP_VERSION,
        latestVersion: null,
        isUpdateAvailable: false,
        isChecking: false,

        checkForUpdates: async () => {
            set({ isChecking: true });
            try {
                const { data, error } = await supabase
                    .from('app_versions')
                    .select('*')
                    .eq('is_active', true)
                    .single();

                if (error) {
                    if (error.code !== 'PGRST116') { // PGRST116 = no rows returned (normal if no active version)
                        console.error('Error checking for updates:', error);
                    }
                    return;
                }

                if (data) {
                    // If the DB version is different from the hardcoded current version, trigger update
                    const isDifferent = data.version !== CURRENT_APP_VERSION;
                    set({
                        latestVersion: data as AppVersion,
                        isUpdateAvailable: isDifferent
                    });
                }
            } catch (err) {
                console.error('Failed to check for updates:', err);
            } finally {
                set({ isChecking: false });
            }
        },

        setupRealtimeSubscription: () => {
            // Don't setup multiple subscriptions
            if (subscription) return;

            subscription = supabase
                .channel('app_versions_changes')
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT', // Only care about new versions being published
                        schema: 'public',
                        table: 'app_versions',
                    },
                    (payload) => {
                        const newVersion = payload.new as AppVersion;
                        if (newVersion.is_active && newVersion.version !== CURRENT_APP_VERSION) {
                            set({
                                latestVersion: newVersion,
                                isUpdateAvailable: true
                            });
                        }
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE', // Also care if an old version is made active
                        schema: 'public',
                        table: 'app_versions',
                    },
                    (payload) => {
                        const newVersion = payload.new as AppVersion;
                        if (newVersion.is_active && newVersion.version !== CURRENT_APP_VERSION) {
                            set({
                                latestVersion: newVersion,
                                isUpdateAvailable: true
                            });
                        } else if (!newVersion.is_active && get().latestVersion?.id === newVersion.id) {
                            // If the current pending update was deactivated, hide the modal
                            set({ isUpdateAvailable: false, latestVersion: null });
                        }
                    }
                )
                .subscribe();
        },

        cleanupSubscription: () => {
            if (subscription) {
                supabase.removeChannel(subscription);
                subscription = null;
            }
        }
    };
});
