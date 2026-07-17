import React, { createContext, useContext, useState, useEffect } from 'react';
import { notify } from "@/lib/notifications";
import { supabase } from "@/integrations/supabase/client";
import { permissionsService } from "@/services/permissionsService";

export interface User {
    id: string;
    username: string;
    name: string;
    role: 'admin' | 'branch' | 'mod';
    branchName?: string;
    branchId?: string;
    branchSheet?: string;
    permissions?: string[];
    assignedBranches?: string[];
}

interface UserContextType {
    user: User | null;
    login: (username: string, password?: string) => Promise<boolean>;
    selectBranch: (branchName: string) => Promise<void>;
    clearBranchSelection: () => void;
    logout: () => void;
    isLoading: boolean;
    allBranches: string[];
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [allBranches, setAllBranches] = useState<string[]>([]);

    useEffect(() => {
        const storedUser = localStorage.getItem('farmaplus_user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        supabase
            .from('branches')
            .select('name')
            .then(({ data, error }) => {
                if (error) {
                    console.error("[UserContext] Error loading branches:", error);
                } else if (data) {
                    setAllBranches(data.map(b => b.name).sort());
                }
            });
    }, []);

    const login = async (usernameInput: string, passwordInput?: string): Promise<boolean> => {
        setIsLoading(true);
        const normalizedInput = usernameInput.toLowerCase().trim().replace(/\s+/g, '');

        try {
            const email = normalizedInput.includes('@')
                ? normalizedInput
                : `${normalizedInput}@farmaplus.system`;

            if (!passwordInput || passwordInput.length === 0) {
                setIsLoading(false);
                return false;
            }

            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password: passwordInput,
            });

            if (authError || !authData.user) {
                console.warn("[Login] Auth failed:", authError?.message);
                setIsLoading(false);
                return false;
            }

            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select(`*, branches (name)`)
                .eq('id', authData.user.id)
                .maybeSingle();

            if (!profileData || profileError) {
                console.warn("[Login] Profile not found");
                setIsLoading(false);
                return false;
            }

            const profile = profileData as any;

            if (profile.active === false && profile.username.toLowerCase() !== 'gcoz') {
                notify.error("Acceso Denegado", "Tu cuenta se encuentra inactiva.");
                setIsLoading(false);
                return false;
            }

            const [zonalResponse, permissions] = await Promise.all([
                profile.role === 'mod'
                    ? (supabase as any).from('zonal_branches').select(`branches (name)`).eq('zonal_id', profile.id)
                    : Promise.resolve({ data: [] }),
                permissionsService.getRolePermissions(profile.role || 'branch')
            ]);

            let assignedBranches: string[] = [];
            if (zonalResponse.data && zonalResponse.data.length > 0) {
                assignedBranches = zonalResponse.data.map((zb: any) => zb.branches?.name).filter(Boolean);
            }

            const finalPermissions = [...permissions];
            if (profile.username === 'gcoz' && !finalPermissions.includes('MANAGE_USERS')) {
                finalPermissions.push('MANAGE_USERS');
            }

            const newUser: User = {
                id: profile.id,
                username: profile.username,
                name: profile.full_name || profile.username,
                role: (profile.role as 'admin' | 'branch' | 'mod') || 'branch',
                branchName: profile.branches?.name || 'Casa Central',
                branchId: profile.branch_id,
                branchSheet: profile.branches?.name || 'Casa Central',
                permissions: finalPermissions,
                assignedBranches: assignedBranches || []
            };

            persistUser(newUser);
            return true;
        } catch (e) {
            console.error("[Login] Error:", e);
            setIsLoading(false);
            return false;
        }
    };

    const persistUser = (user: User) => {
        setUser(user);
        localStorage.setItem('farmaplus_user', JSON.stringify(user));
        setIsLoading(false);
    };

    const selectBranch = async (branchName: string) => {
        if (!user) return;

        try {
            const { data } = await supabase
                .from('branches')
                .select('id')
                .eq('name', branchName)
                .maybeSingle();

            const updatedUser = { 
                ...user, 
                branchName, 
                branchSheet: branchName,
                branchId: data?.id || user.branchId 
            };
            persistUser(updatedUser);
            notify.success("Sucursal Seleccionada", `Ahora estás visualizando los datos de: ${branchName}`);
        } catch (error) {
            console.error('Error selecting branch:', error);
            const updatedUser = { ...user, branchName, branchSheet: branchName };
            persistUser(updatedUser);
        }
    };

    const clearBranchSelection = () => {
        if (!user) return;
        const updatedUser = { ...user, branchName: 'Casa Central', branchSheet: 'Casa Central' };
        persistUser(updatedUser);
        notify.info("Vista Restaurada", "Has regresado a la vista de Administrador.");
    };

    const logout = async () => {
        setUser(null);
        localStorage.removeItem('farmaplus_user');
        await supabase.auth.signOut();
        notify.info("Sesión Cerrada", "Has cerrado sesión correctamente.");
    };

    return (
        <UserContext.Provider value={{ 
            user, 
            login, 
            selectBranch, 
            clearBranchSelection, 
            logout, 
            isLoading, 
            allBranches: user?.role === 'admin' ? allBranches : allBranches.filter(b => b.toLowerCase() !== 'devotox') 
        }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
}
