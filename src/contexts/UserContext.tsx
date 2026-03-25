import React, { createContext, useContext, useState, useEffect } from 'react';
import { BRANCH_NAMES, ZONAL_USERS } from '@/config/users';
import { notify } from "@/lib/notifications";
import { supabase } from "@/integrations/supabase/client";
import { permissionsService } from "@/services/permissionsService";

export interface User {
    id: string;
    username: string;
    name: string;
    role: 'admin' | 'branch' | 'mod';
    branchName?: string; // Optional for admins/mods
    branchId?: string; // UUID of the branch
    branchSheet?: string; // Optional for admins/mods
    permissions?: string[];
    assignedBranches?: string[]; // Array of branch names for mod users
}

interface UserContextType {
    user: User | null;
    login: (username: string, password?: string) => Promise<boolean>;
    selectBranch: (branchName: string) => void;
    clearBranchSelection: () => void;
    logout: () => void;
    isLoading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check for persisted user
        const storedUser = localStorage.getItem('farmaplus_user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        setIsLoading(false);
    }, []);

    const login = async (usernameInput: string, passwordInput?: string): Promise<boolean> => {
        const loginStartTime = performance.now();
        console.time("[Login] Total");
        setIsLoading(true);
        const normalizedInput = usernameInput.toLowerCase().trim().replace(/\s+/g, '');

        // --- STRATEGY 1: SUPABASE AUTH (SECURE) ---
        try {
            const email = normalizedInput.includes('@')
                ? normalizedInput
                : `${normalizedInput}@farmaplus.system`;

            if (passwordInput && passwordInput.length > 0) {
                console.time("[Login] Auth.signIn");
                const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: passwordInput,
                });
                console.timeEnd("[Login] Auth.signIn");

                if (!authError && authData.user) {
                    console.log("[Login] Auth Successful:", authData.user.id);

                    // Fetch profile using the AUTH ID
                    console.time("[Login] Profile Fetch");
                    const { data: profileData, error: profileError } = await supabase
                        .from('profiles')
                        .select(`*, branches (name)`)
                        .eq('id', authData.user.id)
                        .maybeSingle();
                    console.timeEnd("[Login] Profile Fetch");

                    if (profileData && !profileError) {
                        const profile = profileData as any;

                        // PARALLEL FETCH: Zonal Branches + Role Permissions
                        console.time("[Login] Permissions & Zonals Fetch");
                        const [zonalResponse, permissions] = await Promise.all([
                            profile.role === 'mod'
                                ? (supabase as any).from('zonal_branches').select(`branches (name)`).eq('zonal_id', profile.id)
                                : Promise.resolve({ data: [] }),
                            permissionsService.getRolePermissions(profile.role || 'branch')
                        ]);
                        console.timeEnd("[Login] Permissions & Zonals Fetch");

                        let assignedBranches: string[] = [];
                        if (zonalResponse.data && zonalResponse.data.length > 0) {
                            assignedBranches = zonalResponse.data.map((zb: any) => zb.branches?.name).filter(Boolean);
                        }

                        // Prevent lockout for gcoz
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

                        console.timeEnd("[Login] Total");
                        console.log(`[Login] Successful Strategy 1 in ${(performance.now() - loginStartTime).toFixed(2)}ms`);
                        persistUser(newUser);
                        return true;
                    }
                } else {
                    console.warn("[Login] Supabase Auth Login Failed:", authError?.message);
                }
            }
        } catch (e) {
            console.error("[Login] Auth attempt error:", e);
        }

        // --- STRATEGY 2: LEGACY FALLBACK (UNSECURE / MIGRATION) ---
        console.log("[Login] Falling back to Legacy Login...");
        console.time("[Login] Legacy Logic");

        if (passwordInput && passwordInput !== 'farmaplus') {
            setIsLoading(false);
            console.timeEnd("[Login] Legacy Logic");
            console.timeEnd("[Login] Total");
            return false;
        }

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select(`*, branches (name)`)
                .ilike('username', normalizedInput)
                .maybeSingle();

            if (data && !error) {
                const profile = data as any;

                if (profile.active === false && profile.username.toLowerCase() !== 'gcoz') {
                    notify.error("Acceso Denegado", "Tu cuenta se encuentra inactiva. Contacta al administrador.");
                    setIsLoading(false);
                    console.timeEnd("[Login] Legacy Logic");
                    console.timeEnd("[Login] Total");
                    return false;
                }

                // Parallel legacy fetches
                const [zonalResponse, permissions] = await Promise.all([
                    profile.role === 'mod'
                        ? (supabase as any).from('zonal_branches').select(`branches (name)`).eq('zonal_id', profile.id)
                        : Promise.resolve({ data: [] }),
                    permissionsService.getRolePermissions(profile.role || 'branch')
                ]);

                let assignedBranches: string[] = [];
                if (zonalResponse.data) {
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
                    role: (profile.role as 'admin' | 'branch' | 'mod') || 'admin',
                    branchName: profile.branches?.name || 'Casa Central',
                    branchId: profile.branch_id,
                    branchSheet: profile.branches?.name || 'Casa Central',
                    permissions: finalPermissions,
                    assignedBranches: assignedBranches || []
                };

                console.timeEnd("[Login] Legacy Logic");
                console.timeEnd("[Login] Total");
                console.log(`[Login] Successful Strategy 2 in ${(performance.now() - loginStartTime).toFixed(2)}ms`);
                persistUser(newUser);
                return true;
            }
        } catch (e) {
            console.error("[Login] Legacy Supabase lookup error:", e);
        }

        // 2. Buscar en Zonales (Mods) - HARDCODED LIST
        const zonalMatch = ZONAL_USERS.find(u => u.username === normalizedInput);
        if (zonalMatch) {
            const newUser: User = {
                id: `mod_${normalizedInput}`,
                username: normalizedInput,
                name: zonalMatch.name,
                role: 'mod',
                branchName: 'Zona No Asignada',
                branchSheet: 'Zona No Asignada',
                permissions: [],
                assignedBranches: []
            };
            console.timeEnd("[Login] Total");
            persistUser(newUser);
            return true;
        }

        // 3. Buscar en Sucursales (Fallback / Legacy) - BRANCH LIST
        const branchMatch = BRANCH_NAMES.find(branchName => {
            const normalizedBranchName = branchName.toLowerCase().replace(/\s+/g, '');
            return normalizedBranchName === normalizedInput;
        });

        if (branchMatch) {
            const newUser: User = {
                id: `branch_${normalizedInput}`,
                username: normalizedInput,
                name: `Farmacia ${branchMatch}`,
                role: 'branch',
                branchName: branchMatch,
                branchSheet: branchMatch,
                permissions: []
            };
            console.timeEnd("[Login] Total");
            persistUser(newUser);
            return true;
        }

        console.timeEnd("[Login] Total");
        setIsLoading(false);
        return false;
    };

    const persistUser = (user: User) => {
        setUser(user);
        localStorage.setItem('farmaplus_user', JSON.stringify(user));
        setIsLoading(false); // <--- Reset global loading state once user is ready
    };

    const selectBranch = (branchName: string) => {
        if (!user) return;
        const updatedUser = { ...user, branchName: branchName, branchSheet: branchName };
        persistUser(updatedUser);
        notify.success("Sucursal Seleccionada", `Ahora estás visualizando los datos de: ${branchName}`);
    };

    const clearBranchSelection = () => {
        if (!user) return;
        // Revertir a Casa Central o el defecto del admin
        const updatedUser = { ...user, branchName: 'Casa Central', branchSheet: 'Casa Central' };
        persistUser(updatedUser);
        notify.info("Vista Restaurada", "Has regresado a la vista de Administrador.");
    };

    const logout = async () => {
        setUser(null);
        localStorage.removeItem('farmaplus_user');
        await supabase.auth.signOut();
        notify.info("Sesión Cerrada", "Has cerrado sesión correctamente.");
        // We don't necessarily need to clear windows here as the whole App re-mounts/redirects
    };

    return (
        <UserContext.Provider value={{ user, login, selectBranch, clearBranchSelection, logout, isLoading }}>
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

