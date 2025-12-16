import React, { createContext, useContext, useState, useEffect } from 'react';
import { BRANCH_NAMES } from '@/config/users';
import { notify } from "@/lib/notifications";
import { supabase } from "@/integrations/supabase/client";

export interface User {
    id: string;
    username: string;
    name: string;
    role: 'admin' | 'branch';
    branchName?: string; // Optional for admins
    branchSheet?: string; // Optional for admins
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

    const login = async (username: string, password?: string): Promise<boolean> => {
        // Validación de contraseña simple (si no se envía password, asumimos dev mode o bypass previo, pero idealmente requerimos password)
        // Por compatibilidad con llamadas existentes que quizás no pasen password, lo hacemos opcional pero lo validamos si viene
        if (password && password !== 'farmaplus') { // Use constant or env var in real app
            return false;
        }

        const normalizedInput = username.toLowerCase().trim().replace(/\s+/g, '');

        // 1. Try to find in Supabase PROFILES first (The "Connected" way)
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select(`
                    *,
                    branches (
                        name
                    )
                `)
                .ilike('username', normalizedInput) // Case insensitive match
                .maybeSingle();

            if (data && !error) {
                const branchName = data.branches?.name || undefined;

                const newUser: User = {
                    id: data.id,
                    username: data.username,
                    name: data.full_name || data.username,
                    role: (data.role as 'admin' | 'branch') || 'admin',
                    branchName: branchName || 'Casa Central',
                    branchSheet: branchName || 'Casa Central' // Maintain compatibility
                };
                persistUser(newUser);
                return true;
            }
        } catch (e) {
            console.error("Error fetching user from Supabase:", e);
            // Fallback to local logic if DB fails
        }

        // 2. Buscar en Sucursales (Fallback / Legacy)
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
                branchSheet: branchMatch
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
