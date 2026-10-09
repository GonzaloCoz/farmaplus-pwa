import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
    testMysqlConnection,
    fetchMysqlStockDirect,
    listMysqlTables,
    describeMysqlTable,
    executeMysqlRawQuery,
    isTauriEnvironment,
    MysqlConfig,
    MysqlProductRecord,
    MysqlColumnInfo,
    MysqlQueryResult,
} from '@/services/mysqlTauriBridge';
import { notify } from '@/lib/notifications';
import {
    Database01 as Database,
    RefreshCw01 as RefreshCw,
    CheckCircle,
    AlertCircle,
    Terminal,
    Table01 as TableIcon,
    Download01 as Download,
    SearchLg as Search,
    Eye,
    Play,
} from '@untitledui/icons';
import { cn } from '@/lib/utils';

interface MysqlDirectImportModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    branchName?: string;
    onProductsLoaded: (products: MysqlProductRecord[]) => void;
}

const STORAGE_KEY = 'farmaplus_mysql_devotox_config';

export const MysqlDirectImportModal: React.FC<MysqlDirectImportModalProps> = ({
    open,
    onOpenChange,
    branchName = 'devotox',
    onProductsLoaded,
}) => {
    const isDesktop = isTauriEnvironment();

    // Default configuration (saved in localStorage for easy local testing)
    const [config, setConfig] = useState<MysqlConfig>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return {
                    host: parsed.host || '10.0.48.10',
                    port: parsed.port || 3306,
                    user: parsed.user || 'root',
                    password: '',
                    database: parsed.database || 'plex',
                };
            } catch (e) {
                // ignore
            }
        }
        return {
            host: '10.0.48.10',
            port: 3306,
            user: 'root',
            password: '',
            database: 'plex',
        };
    });

    const [tab, setTab] = useState<'connect' | 'tables' | 'query' | 'logs'>('connect');
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{
        success: boolean;
        message: string;
        version?: string;
        db?: string;
        tablesCount?: number;
    } | null>(null);

    const [isImporting, setIsImporting] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [customQuery, setCustomQuery] = useState('');

    // Table Explorer state
    const [tables, setTables] = useState<string[]>([]);
    const [selectedTable, setSelectedTable] = useState<string | null>(null);
    const [columns, setColumns] = useState<MysqlColumnInfo[]>([]);
    const [previewData, setPreviewData] = useState<MysqlQueryResult | null>(null);
    const [isLoadingTables, setIsLoadingTables] = useState(false);

    // Save config on change (excluyendo la contraseña por seguridad de almacenamiento)
    useEffect(() => {
        const { password: _pw, ...safeConfig } = config;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(safeConfig));
    }, [config]);

    const addLog = (msg: string) => {
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    const handleTestConnection = async () => {
        if (!isDesktop) {
            notify.error('Entorno no compatible', 'Debes abrir la app en Windows Desktop (Tauri) para acceder a MySQL.');
            return;
        }

        setIsTesting(true);
        setTestResult(null);
        addLog(`Probando conexión a MySQL ${config.host}:${config.port} con usuario '${config.user}'...`);

        try {
            const res = await testMysqlConnection(config);
            setTestResult({
                success: res.success,
                message: res.message,
                version: res.server_version,
                db: res.current_database,
                tablesCount: res.tables_count,
            });

            if (res.success) {
                notify.success('Conexión Exitosa', `MySQL ${res.server_version || ''} disponible.`);
                addLog(`✓ Conexión exitosa. Versión: ${res.server_version || 'N/A'}. Base de datos: ${res.current_database || 'N/A'}`);
            } else {
                notify.error('Error de Conexión', res.message);
                addLog(`✗ Error: ${res.message}`);
            }
        } catch (e: any) {
            notify.error('Error', e?.message || 'Fallo desconocido al conectar');
            addLog(`✗ Error: ${e?.message}`);
        } finally {
            setIsTesting(false);
        }
    };

    const handleLoadTables = async () => {
        setIsLoadingTables(true);
        addLog('Consultando lista de tablas...');
        try {
            const list = await listMysqlTables(config);
            setTables(list);
            addLog(`Se encontraron ${list.length} tablas en la base de datos.`);
            notify.info('Tablas listadas', `${list.length} tablas encontradas`);
        } catch (e: any) {
            notify.error('Error', e?.message || 'No se pudieron listar las tablas');
            addLog(`✗ Error listando tablas: ${e?.message}`);
        } finally {
            setIsLoadingTables(false);
        }
    };

    const handleSelectTable = async (tableName: string) => {
        setSelectedTable(tableName);
        addLog(`Examinando estructura de tabla: ${tableName}`);
        try {
            const cols = await describeMysqlTable(config, tableName);
            setColumns(cols);

            const preview = await executeMysqlRawQuery(config, `SELECT * FROM \`${tableName}\``, 5);
            setPreviewData(preview);
        } catch (e: any) {
            notify.error('Error', e?.message || 'Error al inspeccionar tabla');
            addLog(`✗ Error al describir tabla: ${e?.message}`);
        }
    };

    const handleImportStock = async () => {
        if (!isDesktop) {
            notify.error('Modo Desktop requerido', 'Ejecuta la app en Tauri para importar desde MySQL.');
            return;
        }

        setIsImporting(true);
        setLogs([]);
        setTab('logs');
        addLog(`Iniciando importación directa para sucursal '${branchName}'...`);

        try {
            const result = await fetchMysqlStockDirect(config, customQuery, (l) => addLog(l));

            if (result.success && result.products.length > 0) {
                notify.success('Importación Completa', `Se cargaron ${result.products.length} productos desde MySQL.`);
                addLog(`✓ ${result.message}`);
                onProductsLoaded(result.products);
                onOpenChange(false);
            } else {
                notify.warning('Sin Productos', result.message || 'La consulta no retornó productos.');
                addLog(`⚠ Advertencia: ${result.message}`);
            }
        } catch (e: any) {
            notify.error('Error de Importación', e?.message || 'Fallo al consultar stock en MySQL');
            addLog(`✗ Error crítico: ${e?.message}`);
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl w-full p-0 overflow-hidden bg-background border-border shadow-2xl rounded-2xl">
                <DialogHeader className="p-6 pb-4 bg-muted/20 border-b border-border/40">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                                <Database className="w-6 h-6" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold text-foreground">
                                    Conexión Directa MySQL
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                    Pruebas locales de importación directa &bull; Sucursal de pruebas: <span className="font-semibold text-foreground uppercase">{branchName}</span>
                                </DialogDescription>
                            </div>
                        </div>
                        {isDesktop ? (
                            <Badge variant="outline" className="bg-success/10 text-success border-success/30 gap-1.5 px-3 py-1 font-mono text-xs">
                                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                                Tauri Desktop
                            </Badge>
                        ) : (
                            <Badge variant="destructive" className="gap-1 px-3 py-1 text-xs">
                                <AlertCircle className="w-3.5 h-3.5" />
                                Modo Web (Requiere Tauri)
                            </Badge>
                        )}
                    </div>
                </DialogHeader>

                <div className="p-6 space-y-5">
                    <Tabs value={tab} onValueChange={(v: any) => setTab(v)} className="w-full">
                        <TabsList className="grid grid-cols-4 bg-muted/40 p-1 rounded-xl">
                            <TabsTrigger value="connect" className="text-xs font-semibold rounded-lg">
                                Conexión
                            </TabsTrigger>
                            <TabsTrigger value="tables" className="text-xs font-semibold rounded-lg">
                                Explorador de Tablas
                            </TabsTrigger>
                            <TabsTrigger value="query" className="text-xs font-semibold rounded-lg">
                                Query SQL
                            </TabsTrigger>
                            <TabsTrigger value="logs" className="text-xs font-semibold rounded-lg">
                                Consola / Logs ({logs.length})
                            </TabsTrigger>
                        </TabsList>

                        {/* TAB 1: CONEXIÓN */}
                        <TabsContent value="connect" className="space-y-4 pt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-foreground mb-1.5 block">Host / IP</label>
                                    <Input
                                        placeholder="127.0.0.1 o IP del Servidor"
                                        value={config.host}
                                        onChange={(e) => setConfig({ ...config, host: e.target.value })}
                                        className="h-10 bg-muted/20"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-foreground mb-1.5 block">Puerto</label>
                                    <Input
                                        type="number"
                                        placeholder="3306"
                                        value={config.port}
                                        onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || 3306 })}
                                        className="h-10 bg-muted/20"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-foreground mb-1.5 block">Usuario MySQL</label>
                                    <Input
                                        placeholder="root"
                                        value={config.user}
                                        onChange={(e) => setConfig({ ...config, user: e.target.value })}
                                        className="h-10 bg-muted/20"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-foreground mb-1.5 block">Contraseña</label>
                                    <Input
                                        type="password"
                                        placeholder="••••••••"
                                        value={config.password || ''}
                                        onChange={(e) => setConfig({ ...config, password: e.target.value })}
                                        className="h-10 bg-muted/20"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs font-semibold text-foreground mb-1.5 block">Nombre de la Base de Datos</label>
                                    <Input
                                        placeholder="farmaplus_devotox (dejar vacío para listar todas)"
                                        value={config.database}
                                        onChange={(e) => setConfig({ ...config, database: e.target.value })}
                                        className="h-10 bg-muted/20"
                                    />
                                </div>
                            </div>

                            {/* Test Status Banner */}
                            {testResult && (
                                <div
                                    className={cn(
                                        'p-4 rounded-xl border flex items-start gap-3 text-sm transition-all',
                                        testResult.success
                                            ? 'bg-success/10 border-success/30 text-success'
                                            : 'bg-destructive/10 border-destructive/30 text-destructive'
                                    )}
                                >
                                    {testResult.success ? (
                                        <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                    ) : (
                                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                    )}
                                    <div className="flex-1 space-y-1">
                                        <p className="font-semibold">{testResult.message}</p>
                                        {testResult.success && (
                                            <p className="text-xs text-foreground/80 font-mono">
                                                Versión: {testResult.version || 'MySQL'} &bull; Tablas disponibles: {testResult.tablesCount}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <Button
                                    variant="outline"
                                    onClick={handleTestConnection}
                                    disabled={isTesting || !isDesktop}
                                    className="flex-1 h-11 rounded-xl gap-2 font-medium"
                                >
                                    {isTesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                    Probar Conexión (Ping)
                                </Button>
                                <Button
                                    variant="default"
                                    onClick={handleImportStock}
                                    disabled={isImporting || !isDesktop}
                                    className="flex-1 h-11 rounded-xl gap-2 shadow-md font-semibold"
                                >
                                    {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                    Importar Stock Ahora
                                </Button>
                            </div>
                        </TabsContent>

                        {/* TAB 2: EXPLORADOR DE TABLAS */}
                        <TabsContent value="tables" className="space-y-4 pt-4">
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-muted-foreground">
                                    Inspecciona las tablas de la base de datos para ver los nombres de columnas.
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleLoadTables}
                                    disabled={isLoadingTables}
                                    className="h-8 gap-1.5 text-xs rounded-lg"
                                >
                                    <RefreshCw className={cn('w-3.5 h-3.5', isLoadingTables && 'animate-spin')} />
                                    Cargar Tablas
                                </Button>
                            </div>

                            {tables.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="border border-border/60 rounded-xl p-2 max-h-60 overflow-y-auto space-y-1 bg-muted/10">
                                        <p className="text-[11px] font-bold text-muted-foreground uppercase px-2 py-1">Tablas ({tables.length})</p>
                                        {tables.map((t) => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => handleSelectTable(t)}
                                                className={cn(
                                                    'w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono truncate transition-colors',
                                                    selectedTable === t
                                                        ? 'bg-primary text-primary-foreground font-semibold'
                                                        : 'hover:bg-muted/40 text-foreground'
                                                )}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="md:col-span-2 border border-border/60 rounded-xl p-3 max-h-60 overflow-y-auto bg-muted/10">
                                        {selectedTable ? (
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                                                    <span className="text-xs font-bold text-foreground font-mono">Tabla: {selectedTable}</span>
                                                    <span className="text-[11px] text-muted-foreground">{columns.length} columnas</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
                                                    {columns.map((c) => (
                                                        <div key={c.name} className="p-1.5 rounded bg-background/60 border border-border/30 flex justify-between">
                                                            <span className="text-foreground font-medium truncate">{c.name}</span>
                                                            <span className="text-muted-foreground text-[10px]">{c.data_type}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-xs text-muted-foreground italic">
                                                Selecciona una tabla para ver sus columnas
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="p-8 text-center text-xs text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border/60">
                                    Haz clic en "Cargar Tablas" para explorar la estructura de la base de datos.
                                </div>
                            )}
                        </TabsContent>

                        {/* TAB 3: QUERY PERSONALIZADA */}
                        <TabsContent value="query" className="space-y-3 pt-4">
                            <div>
                                <label className="text-xs font-semibold text-foreground mb-1.5 block">
                                    Consulta SQL personalizada (Opcional)
                                </label>
                                <textarea
                                    rows={4}
                                    placeholder="Ej: SELECT idproducto, descripcion, stock, codebar, costo, precio FROM productos WHERE stock > 0"
                                    value={customQuery}
                                    onChange={(e) => setCustomQuery(e.target.value)}
                                    className="w-full p-3 rounded-xl bg-muted/20 border border-border font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                                />
                                <p className="text-[11px] text-muted-foreground mt-1">
                                    Si dejas este campo en blanco, Farmaplus detectará automáticamente la tabla y columnas de productos.
                                </p>
                            </div>
                        </TabsContent>

                        {/* TAB 4: CONSOLA / LOGS */}
                        <TabsContent value="logs" className="space-y-3 pt-4">
                            <div className="bg-zinc-950 text-zinc-200 p-3.5 rounded-xl font-mono text-xs h-56 overflow-y-auto border border-zinc-800 space-y-1 shadow-inner">
                                {logs.length === 0 ? (
                                    <p className="text-zinc-500 italic">No hay logs registrados todavía. Realiza un test de conexión o importación.</p>
                                ) : (
                                    logs.map((log, idx) => (
                                        <div key={idx} className={cn(
                                            log.includes('✓') ? 'text-emerald-400' : log.includes('✗') ? 'text-rose-400' : 'text-zinc-300'
                                        )}>
                                            {log}
                                        </div>
                                    ))
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                <DialogFooter className="p-4 bg-muted/20 border-t border-border/40 flex justify-between items-center">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl text-xs">
                        Cerrar
                    </Button>
                    <div className="flex gap-2">
                        <Button
                            variant="default"
                            onClick={handleImportStock}
                            disabled={isImporting || !isDesktop}
                            className="rounded-xl gap-2 font-semibold shadow-md px-6"
                        >
                            {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            Ejecutar Importación
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
