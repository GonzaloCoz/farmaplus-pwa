import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { notify } from "@/lib/notifications";
import { useUser } from "@/contexts/UserContext"; // Import useUser
import {
    Users,
    Shield,
    RefreshCw,
    Search,
    ChevronDown,
    ChevronUp,
    Edit2,
    Trash2,
    Mail,
    Phone,
    MapPin,
    Calendar,
    User as UserIcon,
    Lock,
    Unlock
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Permission, ROLE_PERMISSIONS } from "@/config/permissions";
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

const AVAILABLE_PERMISSIONS: { id: Permission; label: string; group: string }[] = [
    { id: 'VIEW_ADMIN_DASHBOARD', label: 'Ver Panel Administrador', group: 'Visibilidad' },
    { id: 'VIEW_BRANCH_MONITOR', label: 'Ver Monitor de Sucursales', group: 'Visibilidad' },
    { id: 'EDIT_DASHBOARD_LAYOUT', label: 'Editar Diseño del Panel', group: 'Personalización' },
    { id: 'MANAGE_CALENDAR_EVENTS', label: 'Gestionar Eventos de Calendario', group: 'Operaciones' },
    { id: 'MANAGE_INVENTORY_CONFIG', label: 'Configurar Plazos de Inventario', group: 'Operaciones' },
    { id: 'IMPERSONATE_BRANCH', label: 'Simular Sucursal', group: 'Administración' },
    { id: 'EDIT_SETTINGS', label: 'Modificar Ajustes de App', group: 'Administración' },
];

export function UserManagement() {
    const { user } = useUser(); // Get current user
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedUser, setExpandedUser] = useState<string | null>(null);
    const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

    // Strict Access Control for gcoz
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

    const fetchProfiles = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('role', { ascending: true })
                .order('username', { ascending: true });

            if (error) throw error;

            // Map data and handle potential id mismatch or missing columns in types
            const mappedProfiles: Profile[] = (data || []).map((p: any) => ({
                id: p.id || p.user_id || 'unknown', // Fallback for id mismatch
                username: p.username,
                full_name: p.full_name,
                role: p.role,
                active: p.active ?? true, // Default to true if column missing
                created_at: p.created_at,
                branch_id: p.branch_id,
                permissions: p.permissions || []
            }));

            setProfiles(mappedProfiles);
        } catch (error) {
            console.error("Error fetching profiles:", error);
            notify.error("Error", "No se pudieron cargar los usuarios.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProfiles();
    }, []);

    const toggleUserStatus = async (id: string, currentStatus: boolean) => {
        setUpdatingUserId(id);
        const newStatus = !currentStatus;

        // Optimistic update
        setProfiles(prev => prev.map(p => p.id === id ? { ...p, active: newStatus } : p));

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ active: newStatus } as any) // Cast to any to bypass type check
                .eq('id', id); // We expect 'id' to exist now after SQL fix. If it fails, previous SQL didn't run.

            if (error) throw error;

            notify.success(
                newStatus ? "Usuario Activado" : "Usuario Desactivado",
                `El usuario ha sido ${newStatus ? 'habilitado' : 'inhabilitado'} correctamente.`
            );
        } catch (error) {
            console.error("Error toggling status:", error);
            // Rollback
            setProfiles(prev => prev.map(p => p.id === id ? { ...p, active: currentStatus } : p));
            notify.error("Error", "No se pudo actualizar el estado. ¿Ejecutaste el script SQL?");
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

    const handleTogglePermission = async (userId: string, permissionId: string, currentPermissions: string[] = []) => {
        const isAdding = !currentPermissions.includes(permissionId);
        const newPermissions = isAdding
            ? [...currentPermissions, permissionId]
            : currentPermissions.filter(p => p !== permissionId);

        try {
            // Attempt update - fallback to local warning if column is missing
            const { error } = await supabase
                .from('profiles')
                .update({ permissions: newPermissions } as any) // Cast to any
                .eq('id', userId);

            if (error) throw error;

            setProfiles(prev => prev.map(p => p.id === userId ? { ...p, permissions: newPermissions } : p));
            notify.success("Permiso Actualizado", isAdding ? "Permiso añadido." : "Permiso removido.");
        } catch (error) {
            console.warn("Attempted to update missing 'permissions' column:", error);
            notify.error("Advertencia", "No se pudo guardar: la base de datos requiere la columna 'permissions'.");
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
                            onClick={fetchProfiles}
                            disabled={isLoading}
                            className="rounded-xl font-bold px-4 h-11"
                        >
                            <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
                            Actualizar
                        </Button>
                        <Button className="rounded-xl font-bold px-6 h-11 shadow-lg shadow-primary/20">
                            + Añadir Usuario
                        </Button>
                    </div>
                </div>

                <div className="mt-8 relative max-w-2xl">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/50" />
                    <Input
                        placeholder="Buscar por nombre, usuario o correo..."
                        className="pl-12 h-14 bg-muted/30 border-none rounded-2xl focus-visible:ring-primary/20 text-md font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </CardHeader>

            <CardContent className="px-0 pb-0">
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

                                        {/* Row Expansion - Per user details and permissions */}
                                        <AnimatePresence>
                                            {isExpanded && (
                                                <motion.tr
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="bg-primary/[0.02]"
                                                >
                                                    <td colSpan={5} className="p-0">
                                                        <div className="px-24 py-12 grid grid-cols-1 lg:grid-cols-2 gap-16 border-b border-primary/5">
                                                            {/* User Info Column */}
                                                            <div className="space-y-10">
                                                                <div className="space-y-4">
                                                                    <h4 className="text-[11px] font-black text-primary uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                                                        <UserIcon className="w-4 h-4" /> Información Personal
                                                                    </h4>
                                                                    <div className="grid grid-cols-2 gap-8">
                                                                        <div className="space-y-2">
                                                                            <label className="text-xs font-black text-muted-foreground/40 uppercase">Nombre Completo</label>
                                                                            <p className="font-bold flex items-center gap-2">
                                                                                {profile.full_name || "No especificado"}
                                                                            </p>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            <label className="text-xs font-black text-muted-foreground/40 uppercase">Email Corporativo</label>
                                                                            <p className="font-bold flex items-center gap-2 text-primary">
                                                                                <Mail className="w-4 h-4" /> {profile.username}@farmaplus.com
                                                                            </p>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            <label className="text-xs font-black text-muted-foreground/40 uppercase">Empresa / Sucursal</label>
                                                                            <p className="font-bold flex items-center gap-2">
                                                                                <MapPin className="w-4 h-4" /> Casa Central
                                                                            </p>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            <label className="text-xs font-black text-muted-foreground/40 uppercase">Fecha de Ingreso</label>
                                                                            <p className="font-bold flex items-center gap-2">
                                                                                <Calendar className="w-4 h-4" /> {new Date(profile.created_at).toLocaleDateString()}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="pt-6 border-t border-border/10">
                                                                    <h4 className="text-[11px] font-black text-primary uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                                                        <Shield className="w-4 h-4" /> Gestión de Rol
                                                                    </h4>
                                                                    <div className="flex gap-3">
                                                                        {['admin', 'mod', 'branch'].map((r) => (
                                                                            <Button
                                                                                key={r}
                                                                                variant={profile.role === r ? "default" : "outline"}
                                                                                size="sm"
                                                                                className="rounded-xl font-black uppercase text-[10px] h-9 px-4"
                                                                                onClick={() => updateUserRole(profile.id, r)}
                                                                            >
                                                                                {r === 'mod' ? 'Zonal' : r === 'admin' ? 'Admin' : 'Sucursal'}
                                                                            </Button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Permissions Column */}
                                                            <div className="space-y-8">
                                                                <h4 className="text-[11px] font-black text-primary uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                                                    <Lock className="w-4 h-4" /> Privilegios y Accesos
                                                                </h4>
                                                                <div className="grid grid-cols-1 gap-4 h-full">
                                                                    {AVAILABLE_PERMISSIONS.map((perm) => {
                                                                        const isFromRole = ROLE_PERMISSIONS[profile.role]?.includes(perm.id);
                                                                        const isEnabled = profile.permissions?.includes(perm.id) || isFromRole;

                                                                        return (
                                                                            <div key={perm.id} className={cn(
                                                                                "flex items-center justify-between p-4 rounded-2xl border transition-all",
                                                                                isEnabled ? "bg-white dark:bg-zinc-900 shadow-sm border-primary/20" : "bg-muted/10 opacity-40 border-transparent grayscale"
                                                                            )}>
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-xs font-black tracking-tight">{perm.label}</span>
                                                                                    <span className="text-[10px] font-bold text-muted-foreground/60">{perm.group}</span>
                                                                                </div>
                                                                                <div className="flex items-center gap-3">
                                                                                    {isFromRole && <Badge className="rounded-md font-black text-[8px] bg-primary/10 text-primary border-none">POR ROL</Badge>}
                                                                                    <Switch
                                                                                        checked={isEnabled}
                                                                                        disabled={isFromRole}
                                                                                        onCheckedChange={() => handleTogglePermission(profile.id, perm.id, profile.permissions)}
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
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

                {filteredProfiles.length === 0 && !isLoading && (
                    <div className="p-32 flex flex-col items-center gap-6">
                        <div className="h-24 w-24 bg-muted/20 rounded-full flex items-center justify-center">
                            <Search className="w-10 h-10 text-muted-foreground/30" />
                        </div>
                        <p className="font-bold text-muted-foreground italic">No se encontraron usuarios</p>
                    </div>
                )}

                {isLoading && (
                    <div className="p-32 flex flex-col items-center gap-6">
                        <RefreshCw className="w-10 h-10 text-primary animate-spin" />
                        <p className="font-black text-primary uppercase tracking-widest text-[11px]">Cargando Sistema...</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
