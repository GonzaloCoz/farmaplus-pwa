import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Copy,
    Check,
    Smartphone,
    Tablet,
    Send,
    RefreshCw,
    CheckCircle2,
    Loader2,
    QrCode,
    ArrowRight,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { notify as toast } from '@/lib/notifications';
import {
    getRecountDifferences,
    distributeRecountDifferencesToDevices,
    fetchRecountResultSubmissions,
    applyRecountResultsToSession,
    setRecountSessionState,
    getRecountSessionState,
    OnlineRecountDevice,
    RecountDeviceAssignment,
    RecountResultSubmission,
    RecountProductDiff,
} from '@/services/preCountDB';

interface RecountControlDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sessionId: string;
    onApplied?: () => void;
}

const DEFAULT_WEB_BASE_URL = 'https://gonzalocoz.github.io/farmaplus-pwa';

export function RecountControlDialog({
    open,
    onOpenChange,
    sessionId,
    onApplied,
}: RecountControlDialogProps) {
    const [diffs, setDiffs] = useState<RecountProductDiff[]>([]);
    const [isLoadingDiffs, setIsLoadingDiffs] = useState(false);
    const [onlineDevices, setOnlineDevices] = useState<OnlineRecountDevice[]>([]);
    const [assignments, setAssignments] = useState<Record<string, RecountDeviceAssignment>>({});
    const [submissions, setSubmissions] = useState<RecountResultSubmission[]>([]);
    const [isSending, setIsSending] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const [copied, setCopied] = useState(false);
    const [qrDataUrl, setQrDataUrl] = useState<string>('');
    const [hasSentBatch, setHasSentBatch] = useState(false);

    const assignmentsRef = useRef<Record<string, RecountDeviceAssignment>>({});
    const submissionsRef = useRef<RecountResultSubmission[]>([]);
    assignmentsRef.current = assignments;
    submissionsRef.current = submissions;

    const recountUrl = useMemo(() => {
        if (!sessionId) return '';
        let baseUrl = DEFAULT_WEB_BASE_URL;
        if (typeof window !== 'undefined') {
            const origin = window.location.origin;
            const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('tauri.localhost');
            if (origin.startsWith('http') && !isLocal) {
                baseUrl = `${origin}${window.location.pathname.replace(/\/$/, '')}`;
            } else {
                const savedBase = localStorage.getItem('farmaplus_public_web_url');
                if (savedBase && savedBase.trim()) baseUrl = savedBase.trim().replace(/\/$/, '');
            }
        }
        return `${baseUrl}/#/recuento-movil?sessionId=${encodeURIComponent(sessionId)}`;
    }, [sessionId]);

    // Generar código QR cuando abre el diálogo o cambia la URL
    useEffect(() => {
        if (!open || !recountUrl) return;
        QRCode.toDataURL(recountUrl, {
            width: 220,
            margin: 1,
            color: { dark: '#0f172a', light: '#ffffff' },
        })
            .then(setQrDataUrl)
            .catch((err) => console.warn('[RecountControlDialog] Error generando QR:', err));
    }, [open, recountUrl]);

    const loadInitialState = useCallback(async () => {
        if (!sessionId) return;
        setIsLoadingDiffs(true);
        try {
            const [computedDiffs, existingSubs, currentState] = await Promise.all([
                getRecountDifferences(sessionId),
                fetchRecountResultSubmissions(sessionId),
                getRecountSessionState(sessionId),
            ]);
            setDiffs(computedDiffs);
            setSubmissions(existingSubs);

            if (currentState !== 'started') {
                await setRecountSessionState(sessionId, 'waiting');
            }

            // Cargar asignaciones previas si existen
            const { data: assignRow } = await (supabase as any)
                .from('precount_device_files')
                .select('content')
                .eq('session_id', sessionId)
                .eq('filename', 'recount_assignments.json')
                .maybeSingle();

            if (assignRow?.content) {
                try {
                    const parsed = JSON.parse(assignRow.content);
                    if (parsed?.assignments) {
                        setAssignments(parsed.assignments);
                        setHasSentBatch(true);
                    }
                } catch {}
            } else {
                setAssignments({});
                setHasSentBatch(false);
            }
        } finally {
            setIsLoadingDiffs(false);
        }
    }, [sessionId]);

    const refreshConnectedDevices = useCallback(async (presenceList: OnlineRecountDevice[]) => {
        if (!sessionId) return;
        const map = new Map<string, OnlineRecountDevice>();

        // 1. Dispositivos Zebra reportados en precount_connected_devices (activos últimos 5 min)
        try {
            const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            const { data } = await (supabase as any)
                .from('precount_connected_devices')
                .select('device_id, device_name, device_type, status, last_seen')
                .eq('session_id', sessionId)
                .gte('last_seen', fiveMinAgo);

            if (Array.isArray(data)) {
                for (const row of data) {
                    if (row.device_type === 'pc') continue;
                    const devId = String(row.device_id || '').trim();
                    if (!devId) continue;
                    map.set(devId, {
                        device_id: devId,
                        device_name: row.device_name || devId,
                        platform: row.device_type === 'web' ? 'web' : 'zebra',
                        status: 'online',
                        last_seen: row.last_seen,
                    });
                }
            }
        } catch {}

        // 2. Terminales activas en Realtime Presence (celulares web y Zebras en tiempo real)
        for (const p of presenceList) {
            map.set(p.device_id, p);
        }

        // 3. Marcar estado 'completed' si ya enviaron su resultado
        const currentSubs = submissionsRef.current;
        const currentAssignments = assignmentsRef.current;
        const submittedIds = new Set(currentSubs.map((s) => s.device_id));
        const merged = Array.from(map.values()).map((d) => ({
            ...d,
            status: submittedIds.has(d.device_id)
                ? ('completed' as const)
                : currentAssignments[d.device_id]
                    ? ('recounting' as const)
                    : d.status,
            assigned_count: currentAssignments[d.device_id]?.items?.length,
        }));

        setOnlineDevices(merged);
    }, [sessionId]);

    // Suscripción a Realtime Presence + Broadcast de resultados
    useEffect(() => {
        if (!open || !sessionId) return;
        loadInitialState();

        let latestPresence: OnlineRecountDevice[] = [];
        const channel = supabase.channel(`recount_control_${sessionId}`, {
            config: { presence: { key: 'admin-pc' } },
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const list: OnlineRecountDevice[] = [];
                Object.values(state).forEach((entries: any) => {
                    if (!Array.isArray(entries)) return;
                    for (const entry of entries) {
                        if (!entry?.device_id || entry.role === 'admin') continue;
                        list.push({
                            device_id: String(entry.device_id),
                            device_name: String(entry.device_name || entry.device_id),
                            platform: entry.platform === 'zebra' ? 'zebra' : 'web',
                            status: entry.status || 'online',
                            last_seen: entry.last_seen,
                        });
                    }
                });
                latestPresence = list;
                refreshConnectedDevices(latestPresence);
            })
            .on('broadcast', { event: 'recount_result_submitted' }, async () => {
                const updated = await fetchRecountResultSubmissions(sessionId);
                setSubmissions(updated);
                toast.success('Recuento recibido', 'Una terminal finalizó y envió sus diferencias.');
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({ role: 'admin', online_at: new Date().toISOString() });
                    refreshConnectedDevices(latestPresence);
                }
            });

        const pollTimer = setInterval(async () => {
            refreshConnectedDevices(latestPresence);
            const updatedSubs = await fetchRecountResultSubmissions(sessionId);
            setSubmissions(updatedSubs);
        }, 5000);

        return () => {
            clearInterval(pollTimer);
            supabase.removeChannel(channel);
        };
    }, [open, sessionId, loadInitialState, refreshConnectedDevices]);

    const handleCopyLink = async () => {
        if (!recountUrl) return;
        try {
            await navigator.clipboard.writeText(recountUrl);
            setCopied(true);
            toast.success('Enlace copiado', 'Pegalo en el navegador del celular o Zebra.');
            setTimeout(() => setCopied(false), 2000);
        } catch {}
    };

    const handleDistributeAndSend = async () => {
        if (!sessionId) return;
        if (diffs.length === 0) {
            toast.info('Sin diferencias', 'No hay productos con diferencia para distribuir.');
            return;
        }
        if (onlineDevices.length === 0) {
            toast.warning('Sin terminales online', 'Conectá al menos una Zebra o celular escaneando el QR.');
            return;
        }

        setIsSending(true);
        try {
            const { totalDiffs, assignments: created } = await distributeRecountDifferencesToDevices(
                sessionId,
                onlineDevices
            );
            setAssignments(created);
            setSubmissions([]);
            setHasSentBatch(true);

            // Notificar en tiempo real a todas las terminales conectadas
            const channel = supabase.channel(`recount_control_${sessionId}`);
            await channel.send({
                type: 'broadcast',
                event: 'recount_assigned',
                payload: { session_id: sessionId, total_diffs: totalDiffs, generated_at: new Date().toISOString() },
            });

            toast.success(
                'Listados enviados',
                `${totalDiffs} productos con diferencia repartidos entre ${onlineDevices.length} terminal(es).`
            );
        } catch (err: any) {
            toast.error('Error al distribuir', err?.message || String(err));
        } finally {
            setIsSending(false);
        }
    };

    const handleApplyResults = async () => {
        if (!sessionId || submissions.length === 0) return;
        setIsApplying(true);
        try {
            const { updatedProducts } = await applyRecountResultsToSession(sessionId, submissions);
            toast.success(
                'Recuento aplicado',
                `Se actualizaron ${updatedProducts} producto(s) en la tabla antes de enviar a Plex.`
            );
            onApplied?.();
            onOpenChange(false);
        } catch (err: any) {
            toast.error('Error aplicando recuento', err?.message || String(err));
        } finally {
            setIsApplying(false);
        }
    };

    const modifiedPreviewItems = useMemo(() => {
        const list: Array<{ deviceName: string; ean: string; name: string; initialQty: number; recountedQty: number }> = [];
        for (const sub of submissions) {
            for (const it of sub.items) {
                if (it.recountedQty !== it.initialQty) {
                    list.push({
                        deviceName: sub.device_name,
                        ean: it.ean,
                        name: it.name,
                        initialQty: it.initialQty,
                        recountedQty: it.recountedQty,
                    });
                }
            }
        }
        return list;
    }, [submissions]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl p-0 overflow-hidden bg-card border-border/60 rounded-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/50">
                    {/* Columna Izquierda: Link + QR */}
                    <div className="p-6 flex flex-col justify-between bg-muted/10 space-y-5">
                        <div>
                            <DialogHeader className="text-left space-y-1">
                                <DialogTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                                    <QrCode className="w-5 h-5 text-primary" />
                                    Controlar Diferencias
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground">
                                    Escaneá el QR desde las Zebras o celulares para sumarse al recuento en tiempo real.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="mt-4 space-y-1.5">
                                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                    Enlace de recuento móvil
                                </label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        readOnly
                                        value={recountUrl}
                                        className="h-9 text-xs font-mono bg-background/80"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleCopyLink}
                                        className="h-9 px-3 shrink-0"
                                    >
                                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                        <span className="ml-1.5 text-xs">{copied ? 'Copiado' : 'Copiar'}</span>
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-center justify-center py-2">
                            <p className="text-xs font-medium text-muted-foreground mb-3">
                                Escaneá para abrir en la app o navegador
                            </p>
                            <div className="p-3 bg-white rounded-2xl border border-border/50 shadow-sm">
                                {qrDataUrl ? (
                                    <img src={qrDataUrl} alt="QR Recuento Móvil" className="w-44 h-44 object-contain" />
                                ) : (
                                    <div className="w-44 h-44 flex items-center justify-center text-muted-foreground">
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                    </div>
                                )}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-3 text-center">
                                {isLoadingDiffs ? (
                                    'Calculando productos con diferencia...'
                                ) : (
                                    <>
                                        <span className="font-bold text-foreground">{diffs.length}</span> productos únicos con diferencia listos para repartir
                                    </>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Columna Derecha: Terminales Online + Reparto + Resultados */}
                    <div className="p-6 flex flex-col justify-between space-y-5">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-base font-bold tracking-tight">Terminales conectadas</h3>
                                    <p className="text-xs text-muted-foreground">
                                        Cada terminal recibirá un listado exclusivo sin EANs repetidos.
                                    </p>
                                </div>
                                <Badge variant="outline" className="font-mono text-xs px-2.5 py-0.5">
                                    {onlineDevices.length} online
                                </Badge>
                            </div>

                            {/* Lista de terminales */}
                            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                {onlineDevices.length === 0 ? (
                                    <div className="p-4 rounded-xl border border-dashed border-border/70 text-center text-xs text-muted-foreground">
                                        Esperando Zebras o celulares conectados...
                                    </div>
                                ) : (
                                    onlineDevices.map((dev, idx) => {
                                        const previewCount =
                                            assignments[dev.device_id]?.items?.length ??
                                            (diffs.length > 0
                                                ? Math.floor(diffs.length / onlineDevices.length) +
                                                  (idx < diffs.length % onlineDevices.length ? 1 : 0)
                                                : 0);
                                        return (
                                            <div
                                                key={dev.device_id}
                                                className="flex items-center justify-between p-2.5 rounded-xl border border-border/50 bg-muted/20"
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                                        {dev.platform === 'zebra' ? (
                                                            <Tablet className="w-4 h-4" />
                                                        ) : (
                                                            <Smartphone className="w-4 h-4" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-semibold truncate">{dev.device_name}</p>
                                                        <p className="text-[11px] text-muted-foreground">
                                                            {dev.platform === 'zebra' ? 'Colector Zebra' : 'Celular Web'} ·{' '}
                                                            <span className="font-medium text-foreground">{previewCount}</span> SKUs únicos
                                                        </p>
                                                    </div>
                                                </div>
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        dev.status === 'completed'
                                                            ? 'text-[10px] border-emerald-500/30 text-emerald-600 bg-emerald-500/10'
                                                            : dev.status === 'recounting'
                                                                ? 'text-[10px] border-amber-500/30 text-amber-600 bg-amber-500/10'
                                                                : 'text-[10px] border-sky-500/30 text-sky-600 bg-sky-500/10'
                                                    }
                                                >
                                                    {dev.status === 'completed'
                                                        ? 'Finalizado'
                                                        : dev.status === 'recounting'
                                                            ? 'Recontando'
                                                            : 'En línea'}
                                                </Badge>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Resultados recibidos de las terminales */}
                            {submissions.length > 0 && (
                                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                            <CheckCircle2 className="w-4 h-4" />
                                            Recuentos recibidos ({submissions.length}/{onlineDevices.length || submissions.length})
                                        </span>
                                        <span className="text-[11px] text-muted-foreground">
                                            {modifiedPreviewItems.length} con cambio de cantidad
                                        </span>
                                    </div>
                                    {modifiedPreviewItems.length > 0 && (
                                        <div className="max-h-28 overflow-y-auto space-y-1 text-[11px]">
                                            {modifiedPreviewItems.slice(0, 15).map((m, i) => (
                                                <div key={`${m.ean}-${i}`} className="flex items-center justify-between gap-2 text-foreground/90">
                                                    <span className="truncate">{m.name}</span>
                                                    <span className="font-mono shrink-0 flex items-center gap-1">
                                                        {m.initialQty} <ArrowRight className="w-3 h-3" />{' '}
                                                        <strong className="text-emerald-600 dark:text-emerald-400">{m.recountedQty}</strong>
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Acciones */}
                        <div className="pt-2 border-t border-border/40 flex flex-col gap-2">
                            <Button
                                type="button"
                                onClick={handleDistributeAndSend}
                                disabled={isSending || diffs.length === 0 || onlineDevices.length === 0}
                                className="w-full h-10 rounded-xl font-semibold"
                            >
                                {isSending ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : hasSentBatch ? (
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                ) : (
                                    <Send className="w-4 h-4 mr-2" />
                                )}
                                {hasSentBatch ? 'Re-distribuir y Comenzar' : 'Comenzar recuento'}
                            </Button>

                            {submissions.length > 0 && (
                                <Button
                                    type="button"
                                    variant="default"
                                    onClick={handleApplyResults}
                                    disabled={isApplying}
                                    className="w-full h-10 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                    {isApplying ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <CheckCircle2 className="w-4 h-4 mr-2" />
                                    )}
                                    Aplicar recuento al inventario
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
