import { useMemo } from 'react';
import { useUser } from '@/contexts/UserContext';
import { BRANCH_NAMES } from '@/config/users';

/**
 * Hook to get filtered branches based on user role
 * - Admin: All branches
 * - Mod: Only assigned branches
 * - Branch: Only their branch
 */
export function useUserBranches() {
    const { user } = useUser();

    const availableBranches = useMemo(() => {
        if (!user) return [];

        // Admin sees all branches
        if (user.role === 'admin') {
            return BRANCH_NAMES;
        }

        // Mod sees only assigned branches
        if (user.role === 'mod') {
            return user.assignedBranches || [];
        }

        // Branch user sees only their branch
        if (user.role === 'branch' && user.branchName) {
            return [user.branchName];
        }

        return [];
    }, [user]);

    return {
        availableBranches,
        canAccessBranch: (branchName: string) => {
            if (!user) return false;
            if (user.role === 'admin') return true;
            return availableBranches.includes(branchName);
        },
        isAdmin: user?.role === 'admin',
        isMod: user?.role === 'mod',
        isBranch: user?.role === 'branch'
    };
}
