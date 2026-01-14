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
        setIsLoading(true); // Ensure loading state triggered locally if not already
        const normalizedInput = usernameInput.toLowerCase().trim().replace(/\s+/g, '');

        // --- STRATEGY 1: SUPABASE AUTH (SECURE) ---
        try {
            // Construct email. If user provides "gcoz", try "gcoz@farmaplus.system" (or similar convention)
            // Or just check if input looks like email.
            const email = normalizedInput.includes('@')
                ? normalizedInput
                : `${normalizedInput}@farmaplus.system`;

            // Password is mandatory for Auth. If missing, we can't search Auth.
            if (passwordInput && passwordInput.length > 0) {
                const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: passwordInput,
                });

                if (!authError && authData.user) {
                    console.log("Supabase Auth Login Successful", authData.user.id);

                    // Fetch profile using the AUTH ID (linked via foreign key or manual sync)
                    // Note: In our schema, 'id' in profiles should match auth.users.id
                    const { data: profileData, error: profileError } = await supabase
                        .from('profiles')
                        .select(`*, branches (name)`)
                        .eq('id', authData.user.id)
                        .maybeSingle();

                    if (profileData && !profileError) {
                        // Success! Map to our User object
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const profile = profileData as any;

                        // Copy-paste of logic from legacy (permissions, etc)
                        // Fetch assigned branches for mod users
                        let assignedBranches: string[] | undefined = undefined;
                        if (profile.role === 'mod') {
                            const { data: zonalBranches } = await (supabase as any)
                                .from('zonal_branches')
                                .select(`branches (name)`)
                                .eq('zonal_id', profile.id);

                            if (zonalBranches && zonalBranches.length > 0) {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                assignedBranches = zonalBranches.map((zb: any) => zb.branches?.name).filter(Boolean);
                            }
                        }

                        let finalPermissions: string[] = [];
                        if (profile.permissions && Array.isArray(profile.permissions) && profile.permissions.length > 0) {
                            finalPermissions = profile.permissions;
                        } else {
                            finalPermissions = await permissionsService.getRolePermissions(profile.role || 'branch');
                        }

                        // Prevent lockout for gcoz
                        if (profile.username === 'gcoz' && !finalPermissions.includes('MANAGE_USERS')) {
                            finalPermissions.push('MANAGE_USERS');
                        }

                        const newUser: User = {
                            id: profile.id, // Real Auth UUID
                            username: profile.username,
                            name: profile.full_name || profile.username,
                            role: (profile.role as 'admin' | 'branch' | 'mod') || 'branch',
                            branchName: profile.branches?.name || 'Casa Central',
                            branchSheet: profile.branches?.name || 'Casa Central',
                            permissions: finalPermissions,
                            assignedBranches: assignedBranches
                        };

                        persistUser(newUser);
                        setIsLoading(false);
                        return true;
                    }
                } else {
                    console.warn("Supabase Auth Login Failed:", authError?.message);
                }
            }
        } catch (e) {
            console.error("Auth attempt error:", e);
        }

        // --- STRATEGY 2: LEGACY FALLBACK (UNSECURE / MIGRATION) ---
        console.log("Falling back to Legacy Login...");

        // Legacy Password Check (Weak)
        if (passwordInput && passwordInput !== 'farmaplus') {
            // If they provided a password and it wasn't the legacy global password, 
            // AND the Auth attempt failed above, then this is a bad login.
            // UNLESS the user is strictly legacy and uses the global password.
            // For safety during migration, we reject if not 'farmaplus' only if we assume all legacy users use it.
            return false;
        }

        // 1. Try to find in Supabase PROFILES (Legacy Lookup by Username)
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select(`*, branches (name)`)
                .ilike('username', normalizedInput)
                .maybeSingle();

            if (data && !error) {
                // ... (Legacy Profile Logic - COPY PASTED essentially)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const profile = data as any;

                if (profile.active === false && profile.username.toLowerCase() !== 'gcoz') {
                    notify.error("Acceso Denegado", "Tu cuenta se encuentra inactiva. Contacta al administrador (gcoz).");
                    return false;
                }

                const branchName = data.branches?.name || undefined;
                let assignedBranches: string[] | undefined = undefined;
                if (data.role === 'mod') {
                    const { data: zonalBranches } = await (supabase as any)
                        .from('zonal_branches')
                        .select(`branches (name)`)
                        .eq('zonal_id', data.id); // Note: data.id here is likely NOT a UUID if not migrated

                    if (zonalBranches) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        assignedBranches = zonalBranches.map((zb: any) => zb.branches?.name).filter(Boolean);
                    }
                }

                let finalPermissions: string[] = [];
                if (profile.permissions && Array.isArray(profile.permissions) && profile.permissions.length > 0) {
                    finalPermissions = profile.permissions;
                } else {
                    finalPermissions = await permissionsService.getRolePermissions(data.role || 'branch');
                }
                if (data.username === 'gcoz' && !finalPermissions.includes('MANAGE_USERS')) {
                    finalPermissions.push('MANAGE_USERS');
                }

                const newUser: User = {
                    id: data.id,
                    username: data.username,
                    name: data.full_name || data.username,
                    role: (data.role as 'admin' | 'branch' | 'mod') || 'admin',
                    branchName: branchName || 'Casa Central',
                    branchSheet: branchName || 'Casa Central',
                    permissions: finalPermissions,
                    assignedBranches: assignedBranches
                };
                persistUser(newUser);
                return true;
            }
        } catch (e) {
            console.error("Legacy Supabase lookup error:", e);
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
                permissions: []
            };
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
            persistUser(newUser);
            return true;
        }

        return false;
    };

    const persistUser = (user: User) => {
        setUser(user);
        localStorage.setItem('farmaplus_user', JSON.stringify(user));
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

    const logout = () => {
        setUser(null);
        localStorage.removeItem('farmaplus_user');
        notify.info("Sesión Cerrada", "Has cerrado sesión correctamente.");
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

