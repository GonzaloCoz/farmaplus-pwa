import { useSyncManager } from '@/hooks/useSyncManager';
import { Wifi, WifiOff, RefreshCw, CloudOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export function SyncStatus() {
    // Sync status is now shown in the header via SyncStatusButton
    // This floating FAB is no longer needed
    return null;
}
