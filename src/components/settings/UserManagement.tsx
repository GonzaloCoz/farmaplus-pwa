import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { notify } from "@/lib/notifications";
import { useUser } from "@/contexts/UserContext";
import { permissionsService } from "@/services/permissionsService";
import {
    Users,
    Shield,
    RefreshCw,
    Search,
    ChevronDown,
    ChevronUp,
    Edit2,
    Trash2,
    User as UserIcon,
    Plus,
    Mail,
    Lock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import React from "react";

interface Profile {
    id: string;
    username: string;
    full_name: string | null;
    role: string;
    active: boolean;
    created_at: string;
    branch_id?: string | null;
    permissions?: string[];
}

interface PermissionItem {
    id: string;
    code: string;
    description: string;
    category: string;
}

export function UserManagement() {
    const { user } = useUser();

    // Users State
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedUser, setExpandedUser] = useState<string | null>(null);
    const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

    // Permissions Reference State
    const [allPermissions, setAllPermissions] = useState<PermissionItem[]>([]);

    // Access Control
    if (user?.username !== 'gcoz') {
        return (
            <Card className="border-none shadow-md bg-muted/10">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <Shield className="w-12 h-12 mb-4 text-muted-foreground/50" />
                    <p className="text-lg font-bold">Acceso Restringido</p>
                    <p className="text-sm">Esta sección es para uso exclusivo del administrador del sistema (gcoz).</p>
                </CardContent>
            </Card>
        );
    }

    // Load data
    useEffect(() => {
        fetchProfiles();
        loadAllPermissions();
    }, []);

    const loadAllPermissions = async () => {
        try {
            // @ts-ignore
            const perms = await permissionsService.getAllPermissions();
            setAllPermissions(perms || []);
        } catch (error) {
            console.error("Error loading permissions", error);
        }
    };

    // ===== USERS FUNCTIONS =====
    const fetchProfiles = async () => {
        setIsLoadingUsers(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('role', { ascending: true })
                .order('username', { ascending: true });

            if (error) throw error;

            const mappedProfiles: Profile[] = (data || []).map((p: any) => ({
                id: p.id || p.user_id || 'unknown',
                username: p.username,
                full_name: p.full_name,
                role: p.role,
                active: p.active ?? true,
                created_at: p.created_at,
                branch_id: p.branch_id,
                permissions: p.permissions || [] // Ensure this is an array
            }));

            setProfiles(mappedProfiles);
        } catch (error) {
            console.error("Error fetching profiles:", error);
            notify.error("Error", "No se pudieron cargar los usuarios.");
        } finally {
            setIsLoadingUsers(false);
        }
    };

    const toggleUserStatus = async (id: string, currentStatus: boolean) => {
        setUpdatingUserId(id);
        const newStatus = !currentStatus;
        setProfiles(prev => prev.map(p => p.id === id ? { ...p, active: newStatus } : p));

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ active: newStatus } as any)
                .eq('id', id);

            if (error) throw error;

            notify.success(
                newStatus ? "Usuario Activado" : "Usuario Desactivado",
                `El usuario ha sido ${newStatus ? 'habilitado' : 'inhabilitado'} correctamente.`
            );
        } catch (error) {
            console.error("Error toggling status:", error);
            setProfiles(prev => prev.map(p => p.id === id ? { ...p, active: currentStatus } : p));
            notify.error("Error", "No se pudo actualizar el estado.");
        } finally {
            setUpdatingUserId(null);
        }
    };

    const updateUserRole = async (userId: string, newRole: string) => {
        setUpdatingUserId(userId);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', userId);

            if (error) throw error;

            setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole } : p));
            notify.success("Rol Actualizado", `El usuario ahora tiene el rol de ${newRole}.`);
        } catch (error) {
            notify.error("Error", "No se pudo actualizar el rol.");
        } finally {
            setUpdatingUserId(null);
        }
    };

    const toggleUserPermission = async (userId: string, permissionCode: string, currentPermissions: string[] = []) => {
        const hasPermission = currentPermissions.includes(permissionCode);
        const newPermissions = hasPermission
            ? currentPermissions.filter(p => p !== permissionCode)
            : [...currentPermissions, permissionCode];

        // Optimistic update
        setProfiles(prev => prev.map(p => p.id === userId ? { ...p, permissions: newPermissions } : p));

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ permissions: newPermissions } as any)
                .eq('id', userId);

            if (error) throw error;
        } catch (error) {
            console.error("Error updating permissions:", error);
            notify.error("Error", "No se pudieron actualizar los permisos del usuario");
            // Revert
            setProfiles(prev => prev.map(p => p.id === userId ? { ...p, permissions: currentPermissions } : p));
        }
    };

    const filteredProfiles = profiles.filter(p =>
        p.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.full_name?.toLowerCase() || "").includes(searchTerm.toLowerCase())
    );

    const getRoleInfo = (role: string) => {
        switch (role) {
            case 'admin': return { label: 'Administrador', color: 'bg-red-500/10 text-red-600 border-red-200' };
            case 'mod': return { label: 'Zonal (Mod)', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-200' };
            default: return { label: 'Sucursal', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' };
        }
    };

    return (
        <Card className="border-none shadow-2xl bg-white dark:bg-zinc-950 overflow-hidden rounded-[2rem]">
            <CardHeader className="px-8 pt-8 pb-6 bg-gradient-to-b from-muted/20 to-transparent">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 bg-primary rounded-[1.25rem] flex items-center justify-center shadow-lg shadow-primary/20">
                            <Users className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-black tracking-tight text-foreground">Control de Usuarios</CardTitle>
                            <CardDescription className="font-semibold text-muted-foreground">
                                {profiles.length} usuarios registrados en la plataforma
                            </CardDescription>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => fetchProfiles()}
                            disabled={isLoadingUsers}
                            className="rounded-xl font-bold px-4 h-11"
                        >
                            <RefreshCw className={cn("w-4 h-4 mr-2", isLoadingUsers && "animate-spin")} />
                            Actualizar
                        </Button>
                        <Button className="rounded-xl font-bold px-6 h-11 shadow-lg shadow-primary/20">
                            + Añadir Usuario
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="px-8 pb-8">
                {/* USERS CONTENT */}
                <div className="space-y-6">
                    <div className="relative max-w-2xl">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/50" />
                        <Input
                            placeholder="Buscar por nombre, usuario o correo..."
                            className="pl-12 h-14 bg-muted/30 border-none rounded-2xl focus-visible:ring-primary/20 text-md font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="border-b border-border/10">
                                    <th className="pl-8 pr-4 py-4 text-left text-[11px] font-black text-muted-foreground/60 uppercase tracking-[0.1em] w-[40px]"></th>
                                    <th className="px-4 py-4 text-left text-[11px] font-black text-muted-foreground/60 uppercase tracking-[0.1em]">Usuario</th>
                                    <th className="px-4 py-4 text-left text-[11px] font-black text-muted-foreground/60 uppercase tracking-[0.1em]">Cargo / Rol</th>
                                    <th className="px-4 py-4 text-center text-[11px] font-black text-muted-foreground/60 uppercase tracking-[0.1em]">Estado</th>
                                    <th className="pl-4 pr-8 py-4 text-right text-[11px] font-black text-muted-foreground/60 uppercase tracking-[0.1em]">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/5">
                                {filteredProfiles.map((profile) => {
                                    const role = getRoleInfo(profile.role);
                                    const isExpanded = expandedUser === profile.id;

                                    return (
                                        <React.Fragment key={profile.id}>
                                            <tr className={cn(
                                                "transition-colors duration-200",
                                                isExpanded ? "bg-primary/5 shadow-inner" : "hover:bg-muted/30"
                                            )}>
                                                <td className="pl-8 pr-4 py-5">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-lg hover:bg-primary/10"
                                                        onClick={() => setExpandedUser(isExpanded ? null : profile.id)}
                                                    >
                                                        {isExpanded ? <ChevronUp className="h-4 w-4 text-primary" /> : <ChevronDown className="h-4 w-4" />}
                                                    </Button>
                                                </td>
                                                <td className="px-4 py-5">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-12 w-12 rounded-2xl overflow-hidden bg-muted flex items-center justify-center border-2 border-white shadow-sm">
                                                            {profile.full_name ? (
                                                                <div className="h-full w-full bg-primary/10 flex items-center justify-center font-black text-primary text-xl uppercase">
                                                                    {profile.full_name.charAt(0)}
                                                                </div>
                                                            ) : (
                                                                <UserIcon className="w-6 h-6 text-muted-foreground" />
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-foreground text-md leading-none">{profile.full_name || '@' + profile.username}</span>
                                                            <span className="text-xs font-semibold text-muted-foreground/60 mt-1">
                                                                {profile.username}@farmaplus.com
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-5">
                                                    <div className={cn(
                                                        "inline-flex items-center px-3 py-1.5 rounded-xl border text-xs font-black uppercase tracking-wider",
                                                        role.color
                                                    )}>
                                                        <Shield className="w-3 h-3 mr-2" />
                                                        {role.label}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-5">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <Switch
                                                            checked={profile.active}
                                                            disabled={updatingUserId === profile.id}
                                                            onCheckedChange={() => toggleUserStatus(profile.id, profile.active)}
                                                            className="data-[state=checked]:bg-emerald-500 scale-110"
                                                        />
                                                        <Badge variant="outline" className={cn(
                                                            "px-2 py-0 border-none font-black text-[10px] uppercase",
                                                            profile.active ? "text-emerald-500" : "text-red-500"
                                                        )}>
                                                            {profile.active ? 'Activo' : 'Inactivo'}
                                                        </Badge>
                                                    </div>
                                                </td>
                                                <td className="pl-4 pr-8 py-5 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:text-primary transition-all"
                                                            onClick={() => setExpandedUser(isExpanded ? null : profile.id)}
                                                        >
                                                            <Edit2 className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-10 w-10 rounded-xl hover:bg-red-500/10 hover:text-red-500 transition-all opacity-40 hover:opacity-100"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>

                                            <AnimatePresence>
                                                {isExpanded && (
                                                    <motion.tr
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: "auto", opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="bg-primary/[0.02]"
                                                    >
                                                        <td colSpan={5} className="p-0">
                                                            <div className="px-12 py-10 border-b border-primary/5">
                                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                                                    {/* Left Column: Personal Info & Role */}
                                                                    <div className="space-y-10">
                                                                        <div className="space-y-6">
                                                                            <h4 className="text-[11px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                                                                <UserIcon className="w-4 h-4" /> Información Personal
                                                                            </h4>

                                                                            <div className="grid grid-cols-2 gap-8">
                                                                                <div className="space-y-2">
                                                                                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-bold block">Nombre Completo</label>
                                                                                    <div className="font-bold text-foreground text-lg">{profile.full_name || 'Sin nombre'}</div>
                                                                                </div>
                                                                                <div className="space-y-2">
                                                                                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-bold block">Email Corporativo</label>
                                                                                    <div className="font-bold text-foreground text-lg flex items-center gap-2">
                                                                                        <Mail className="w-4 h-4 text-primary" />
                                                                                        {profile.username}@farmaplus.com
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        <div className="space-y-6 pt-6 border-t border-border/5">
                                                                            <h4 className="text-[11px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                                                                <Shield className="w-4 h-4" /> Gestión de Rol
                                                                            </h4>
                                                                            <div className="bg-muted/30 p-1.5 rounded-2xl inline-flex gap-1">
                                                                                {['admin', 'mod', 'branch'].map((r) => (
                                                                                    <Button
                                                                                        key={r}
                                                                                        variant={profile.role === r ? "default" : "ghost"}
                                                                                        size="sm"
                                                                                        className={cn(
                                                                                            "rounded-xl font-bold uppercase text-[10px] h-9 px-6 transition-all",
                                                                                            profile.role === r ? "shadow-md" : "hover:bg-background/80 text-muted-foreground"
                                                                                        )}
                                                                                        onClick={() => updateUserRole(profile.id, r)}
                                                                                    >
                                                                                        {r === 'mod' ? 'Zonal' : r === 'admin' ? 'Admin' : 'Sucursal'}
                                                                                    </Button>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Right Column: Privileges */}
                                                                    <div className="space-y-6">
                                                                        <h4 className="text-[11px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                                                            <Lock className="w-4 h-4" /> Privilegios y Accesos
                                                                        </h4>

                                                                        <div className="grid grid-cols-1 gap-3">
                                                                            {allPermissions.map((perm) => {
                                                                                const isEnabled = (profile.permissions || []).includes(perm.code);
                                                                                return (
                                                                                    <div key={perm.code} className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-transparent hover:border-primary/10 transition-colors">
                                                                                        <div className="space-y-1">
                                                                                            <span className="font-bold text-sm block">{perm.description}</span>
                                                                                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{perm.category}</span>
                                                                                        </div>
                                                                                        <div className="flex items-center gap-3">
                                                                                            <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-wider bg-primary/5 text-primary/80 border-none px-2">
                                                                                                Por Usuario
                                                                                            </Badge>
                                                                                            <Switch
                                                                                                checked={isEnabled}
                                                                                                onCheckedChange={() => toggleUserPermission(profile.id, perm.code, profile.permissions)}
                                                                                                className="data-[state=checked]:bg-primary"
                                                                                            />
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                            {allPermissions.length === 0 && (
                                                                                <div className="text-center py-8 text-muted-foreground text-sm italic">
                                                                                    No hay permisos definidos en el sistema.
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </motion.tr>
                                                )}
                                            </AnimatePresence>
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
