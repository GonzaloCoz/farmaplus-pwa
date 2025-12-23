
import { useState, useEffect } from "react";
import { auditService, AuditLogEntry } from "@/services/auditService";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { PageSkeleton } from "@/components/skeletons/PageSkeleton";

export default function AdminAudit() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const data = await auditService.getLogs({ limit: 100 });
                setLogs(data || []);
            } catch (e) {
                console.error("Error fetching logs", e);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    if (loading) return <PageSkeleton />;

    return (
        <div className="space-y-6 p-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Registro de Auditoría</h1>
                <Badge variant="outline" className="text-muted-foreground">Últimos 100 eventos</Badge>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Eventos del Sistema</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Acción</TableHead>
                                <TableHead>Entidad</TableHead>
                                <TableHead>Detalles</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                                        {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={log.action.includes('DELETE') ? 'destructive' : 'secondary'}>
                                            {log.action}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        <span className="font-medium">{log.entity_type}</span>
                                        {log.entity_id && <span className="text-xs text-muted-foreground ml-2">#{log.entity_id.substring(0, 8)}</span>}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                        {log.details ? JSON.stringify(log.details) : '-'}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {logs.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                        No hay registros de auditoría encontrados.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
