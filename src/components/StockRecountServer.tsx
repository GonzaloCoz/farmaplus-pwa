import React, { useState, useEffect, useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Laptop, Smartphone, Play, StopCircle, UsersGroupTwoRounded, DocumentText, Refresh, GraphUp as TrendingUp, GraphDown as TrendingDown, Magnifer as Search, Filter, AltArrowDown as ChevronDown } from "@solar-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { notify } from "@/lib/notifications";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FixedSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import type { ListChildComponentProps } from "react-window";
import { cn } from "@/lib/utils";

interface StockRecountServerProps {
  file: File;
  onClear: () => void;
}

interface ParsedProduct {
  id_producto?: string;
  ean: string;
  name: string;
  lab?: string;
  systemStock: number;
  cost: number;
  initialQty: number;
}

interface RecountItem extends ParsedProduct {
  counted_qty: number;
  status: 'pending' | 'counted' | 'completed';
}

interface ConnectedDevice {
  id: string; // assignment id
  device_name: string;
  device_id: string;
  status: 'connected' | 'counting' | 'completed';
}

type SessionStatus = 'parsing' | 'wait_lobby' | 'counting' | 'completed';

export const StockRecountServer: React.FC<StockRecountServerProps> = ({ file, onClear }) => {
  const { user } = useUser();
  const [status, setStatus] = useState<SessionStatus>('parsing');
  const [products, setProducts] = useState<ParsedProduct[]>([]);
  const [recountItems, setRecountItems] = useState<RecountItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'counted'>('all');
  const [accessCode, setAccessCode] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [connectedDevices, setConnectedDevices] = useState<ConnectedDevice[]>([]);
  
  // Realtime stats
  const [totalCounted, setTotalCounted] = useState(0);

  // Parse Excel on Mount
  useEffect(() => {
    const parseExcel = async () => {
      try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        const headers = json[0];
        const getIndex = (possibleNames: string[], defaultIdx: number, excludeNames?: string[]) => {
           if (!headers) return defaultIdx;
           const lowerHeaders = headers.map(h => String(h).toLowerCase().trim());
           for (const name of possibleNames) {
             const idx = lowerHeaders.findIndex(h => {
                const matches = h.includes(name);
                if (!matches) return false;
                if (excludeNames) {
                   return !excludeNames.some(e => h.includes(e));
                }
                return true;
             });
             if (idx !== -1) return idx;
           }
           return defaultIdx;
        };

        const codeIndex = getIndex(['codebar', 'código', 'codigo', 'ean'], 6);
        const nameIndex = getIndex(['complet', 'completo', 'descripción', 'description'], 10, ['id']);
        const labIndex = getIndex(['lab', 'laboratorio', 'fabricante'], 11);
        const initialQtyIndex = getIndex(['cantidad', 'n'], 13);
        const systemIndex = getIndex(['sistema', 'system', 'stock'], 15);
        const costIndex = getIndex(['costo', 'cost'], 19);
        const idIndex = getIndex(['id_producto', 'idproducto', 'id'], -1);

        const parsedProducts: ParsedProduct[] = [];
        const rows = json.slice(1);

        rows.forEach(row => {
          const ean = String(row[codeIndex] || '').trim().replace(/[^0-9a-zA-Z]/g, '');
          const name = String(row[nameIndex] || '').trim();
          if (ean && name) {
             parsedProducts.push({
               id_producto: idIndex >= 0 ? String(row[idIndex] || '').trim() : '',
               ean,
               name,
               lab: labIndex >= 0 ? String(row[labIndex] || '').trim() : '',
               systemStock: Number(row[systemIndex]) || 0,
               cost: Number(row[costIndex]) || 0,
               initialQty: Number(row[initialQtyIndex]) || 0,
             });
          }
        });

        if (parsedProducts.length === 0) {
           notify.error("Error", "No se encontraron productos válidos en el Excel (Revisa las columnas EAN/Producto)");
           onClear();
           return;
        }

        setProducts(parsedProducts);
        await createSession(parsedProducts);

      } catch (error) {
        console.error("Error parsing Excel:", error);
        notify.error("Error", "Error al procesar el archivo Excel");
        onClear();
      }
    };

    parseExcel();
  }, [file]);

  const createSession = async (parsedProducts: ParsedProduct[]) => {
    if (!user) {
        notify.error("Error", "Usuario no autenticado");
        onClear();
        return;
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setAccessCode(code);

    try {
      const { data: sessionData, error: sessionError } = await (supabase as any)
        .from('stock_recount_sessions')
        .insert({
           access_code: code,
           branch_id: user.branchId || null,
           created_by: user.id,
           status: 'waiting',
           excel_data: parsedProducts
        })
        .select('id')
        .single();

      if (sessionError) {
        console.error("Session Error:", sessionError);
        notify.error("Error de conexión", "No se pudo crear la sesión en la base de datos.");
        setStatus('wait_lobby');
        setSessionId('mock-session-' + code);
        return;
      }

      setSessionId(sessionData.id);
      setStatus('wait_lobby');
      subscribeToAssignments(sessionData.id);

    } catch (e) {
      console.error(e);
      setStatus('wait_lobby');
    }
  };

  const subscribeToAssignments = (sId: string) => {
      const channel = supabase.channel(`assignments_${sId}`)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'stock_recount_assignments',
            filter: `session_id=eq.${sId}` 
         }, (payload) => {
             const newDevice = payload.new as any;
             setConnectedDevices(prev => [...prev, newDevice]);
             notify.success("Nueva conexión", `Se conectó el dispositivo: ${newDevice.device_name}`);
         })
         .subscribe();
      
      return () => {
         supabase.removeChannel(channel);
      };
  };

  const handleStartRecount = async () => {
      if (connectedDevices.length === 0) {
          notify.warning("Atención", "No hay dispositivos Zebra conectados. Espera a que se conecte al menos uno.");
          return; 
      }

      notify.info("Iniciando", "Distribuyendo productos a los dispositivos...");
      setStatus('counting');

      if (!sessionId || sessionId.startsWith('mock')) return;
      
      const deviceCount = Math.max(1, connectedDevices.length);
      const itemsPerDevice = Math.ceil(products.length / deviceCount);
      
      const inserts = [];
      let currentDeviceIdx = 0;

      for (let i = 0; i < products.length; i++) {
          const product = products[i];
          const assignedDevice = connectedDevices[currentDeviceIdx];
          
          inserts.push({
              session_id: sessionId,
              assignment_id: assignedDevice ? assignedDevice.id : null,
              ean: product.ean,
              product_name: product.name,
              lab: product.lab,
              system_qty: product.systemStock,
              cost: product.cost,
              initial_qty: product.initialQty,
              counted_qty: product.initialQty,
              status: product.initialQty > 0 ? 'counted' : 'pending'
          });

          if ((i + 1) % itemsPerDevice === 0 && currentDeviceIdx < deviceCount - 1) {
              currentDeviceIdx++;
          }
      }

      await (supabase as any).from('stock_recount_items').insert(inserts);
      await (supabase as any).from('stock_recount_sessions').update({ status: 'counting' }).eq('id', sessionId);
  };

  // Fetch items for the list when counting
  useEffect(() => {
    if (status !== 'counting' || !sessionId) return;

    const fetchItems = async () => {
      const { data, error } = await (supabase as any)
        .from('stock_recount_items')
        .select('*')
        .eq('session_id', sessionId);
      
      if (!error && data) {
        setRecountItems(data.map((d: any) => ({
          ...d,
          ean: d.ean,
          name: d.product_name,
          systemStock: Number(d.system_qty),
          initialQty: Number(d.initial_qty),
          cost: Number(d.cost),
          counted_qty: Number(d.counted_qty || 0)
        })));
        setTotalCounted(data.filter((i: any) => i.status === 'counted').length);
      }
    };

    fetchItems();
    const interval = setInterval(fetchItems, 3000);
    return () => clearInterval(interval);
  }, [status, sessionId]);

  const filteredItems = useMemo(() => {
    return recountItems
      .filter(item => {
        const matchesSearch = (item.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                             (item.ean || '').includes(searchTerm) ||
                             (item.lab || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        const diff = item.counted_qty - item.systemStock;
        const matchesFilter = filterTab === 'all' || 
                             (filterTab === 'pending' && diff < 0) || 
                             (filterTab === 'counted' && diff > 0);
        
        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        const labA = a.lab || "";
        const labB = b.lab || "";
        if (labA !== labB) return labA.localeCompare(labB);
        return (a.name || "").localeCompare(b.name || "");
      });
  }, [recountItems, searchTerm, filterTab]);

  const RecountRow = ({ index, style, data }: ListChildComponentProps) => {
    const item = data[index];
    const diff = item.counted_qty - item.systemStock;
    const diffValue = diff * item.cost;

    return (
      <div style={style} className="px-4">
        <div className="grid grid-cols-12 gap-4 h-full items-center border-b border-border/40 hover:bg-muted/10 transition-colors group">
          <div className="col-span-4 flex items-center gap-3 pl-2 min-w-0">
            <div className={cn("p-2 rounded-lg shrink-0", diff < 0 ? 'bg-destructive/10 text-destructive' : diff > 0 ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground')}>
              {diff < 0 ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground truncate" title={item.name}>{item.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-[10px] h-4 font-mono text-muted-foreground border-border/60">
                  {item.ean}
                </Badge>
                {item.lab && (
                  <span className="text-[10px] text-primary font-medium">{item.lab}</span>
                )}
              </div>
            </div>
          </div>

          <div className="col-span-2 text-right self-center">
            <p className="text-sm font-medium">${item.cost.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Costo Unit.</p>
          </div>

          <div className="col-span-2 flex justify-center self-center">
            {diff !== 0 && (
               <Badge className={cn("gap-1 py-1 px-2.5 font-bold", diff > 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                  {diff > 0 ? "+" : ""}{diff}
               </Badge>
            )}
          </div>

          <div className="col-span-2 text-center self-center">
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-sm font-bold text-foreground">{item.counted_qty}</span>
              <span className="text-xs text-muted-foreground">/</span>
              <span className="text-xs text-muted-foreground">{item.systemStock}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Físico / Sist.</p>
          </div>

          <div className="col-span-2 text-right pr-4 self-center">
             <p className={cn("text-sm font-bold", diff > 0 ? "text-success" : diff < 0 ? "text-destructive" : "text-muted-foreground")}>
                {diff > 0 ? "+" : diff < 0 ? "-" : ""}${Math.abs(diffValue).toLocaleString()}
             </p>
             <p className="text-[10px] text-muted-foreground">Total ($)</p>
          </div>
        </div>
      </div>
    );
  };

  const handleFinishAndExport = async () => {
      if (!sessionId) return;
      
      try {
          const { data, error } = await (supabase as any)
              .from('stock_recount_items')
              .select('ean, counted_qty')
              .eq('session_id', sessionId)
              .not('counted_qty', 'is', null);

          if (error) throw error;

          const countsMap = new Map((data || []).map((i: any) => [i.ean, i.counted_qty]));
          
          const lines = products.map((p: any) => {
              const count = countsMap.has(p.ean) ? countsMap.get(p.ean) : 0;
              return `${p.id_producto || ''};${p.ean};${count};0`;
          });

          const content = lines.join('\n');
          const blob = new Blob([content], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `Recuento_Stock_${new Date().toISOString().split('T')[0]}.txt`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          notify.success("Finalizado", "Se descargó el TXT del recuento");
          handleCancel();

      } catch (e) {
          console.error("Export error", e);
          notify.error("Error al exportar", "No se pudo generar el TXT final");
      }
  };

  const handleCancel = async () => {
      if (sessionId && !sessionId.startsWith('mock')) {
         await (supabase as any).from('stock_recount_sessions').update({ status: 'completed' }).eq('id', sessionId);
      }
      onClear();
  };

  if (status === 'parsing') {
     return (
        <div className="p-12 text-center animate-pulse">
           <p className="text-muted-foreground font-medium">Procesando archivo Excel...</p>
        </div>
     );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <Card className="p-6 sm:p-8 relative overflow-hidden bg-background border-none shadow-sm ring-1 ring-muted">
        
        <div className="absolute top-0 right-0 p-32 bg-primary/5 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2"></div>

        <div className="flex items-center justify-between mb-8">
           <div>
              <h2 className="text-2xl font-bold text-foreground tracking-tight">
                 {status === 'wait_lobby' ? 'Recuento de Stock Inteligente' : 'Recuento en curso'}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                 <div className={cn("w-2 h-2 rounded-full", status === 'wait_lobby' ? 'bg-warning animate-pulse' : 'bg-success animate-pulse')}></div>
                 <p className="text-muted-foreground text-sm">
                    {status === 'wait_lobby' ? 'Esperando dispositivos...' : 'Sincronizado con Zebras'}
                 </p>
              </div>
           </div>
           {status === 'counting' && (
              <div className="text-right">
                 <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Global</p>
                 <p className="text-2xl font-black text-primary font-mono leading-none">
                    {Math.round((totalCounted / Math.max(1, products.length)) * 100)}%
                 </p>
              </div>
           )}
        </div>

        {status === 'wait_lobby' && (
           <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             className="flex flex-col items-center"
           >
              <div className="bg-muted/30 border border-muted px-8 py-6 rounded-xl mb-8 shadow-inner text-center">
                 <p className="uppercase text-xs font-bold text-muted-foreground tracking-widest mb-3">PIN de Acceso</p>
                 <p className="text-6xl font-black text-foreground tracking-[0.2em] font-mono leading-none">
                    {accessCode}
                 </p>
              </div>

              <div className="relative w-full max-w-sm h-40 flex items-center justify-between mb-8 px-8">
                 <div className="flex flex-col items-center gap-3 z-10">
                    <div className="w-16 h-28 bg-muted/20 border-2 border-border rounded-xl flex items-center justify-center shadow-sm relative">
                       <Smartphone className="w-8 h-8 text-muted-foreground/50" />
                       <div className="absolute -top-1.5 -right-1.5">
                          {connectedDevices.length > 0 && (
                            <span className="flex h-5 w-5 bg-success rounded-full items-center justify-center text-[10px] font-bold text-white shadow-sm ring-2 ring-background">
                              {connectedDevices.length}
                            </span>
                          )}
                       </div>
                    </div>
                    <div className="text-center">
                       <p className="text-[10px] text-muted-foreground uppercase font-semibold">Cliente</p>
                       <p className="text-xs font-medium text-foreground">Zebras ({connectedDevices.length})</p>
                    </div>
                 </div>

                 <div className="flex-1 flex items-center justify-center gap-2 text-muted-foreground/30 px-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse delay-75"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse delay-150"></div>
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse mx-1"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse delay-300"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse delay-500"></div>
                 </div>

                 <div className="flex flex-col items-center gap-3 z-10">
                    <div className="w-28 h-20 bg-muted/20 border-2 border-border rounded-lg flex items-center justify-center shadow-sm relative">
                       <Laptop className="w-8 h-8 text-primary" />
                    </div>
                    <div className="text-center mt-2">
                       <p className="text-[10px] text-muted-foreground uppercase font-semibold">Servidor</p>
                       <p className="text-xs font-medium text-foreground">Esta PC</p>
                    </div>
                 </div>
              </div>

              <div className="w-full max-w-md bg-muted/20 border border-muted/50 rounded-lg p-5 mb-8">
                <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-foreground border-b border-border/50 pb-3">
                   <DocumentText className="w-5 h-5 text-muted-foreground" />
                   Detalles del Recuento
                </div>
                <div className="space-y-3">
                   <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Archivo Base</span>
                      <span className="font-medium truncate max-w-[200px]">{file?.name}</span>
                   </div>
                   <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total de Productos</span>
                      <span className="font-medium">{products.length.toLocaleString()} items</span>
                   </div>
                   <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Dispositivos Listos</span>
                      <span className={connectedDevices.length > 0 ? "font-bold text-success" : "font-medium text-muted-foreground"}>
                        {connectedDevices.length} conectados
                      </span>
                   </div>
                </div>
              </div>

              <div className="w-full max-w-md flex items-center justify-between gap-4 mt-8">
                 <Button variant="outline" size="lg" className="flex-1 rounded-full h-14" onClick={handleCancel}>
                    Cancelar
                 </Button>
                 <Button 
                   variant="default" 
                   size="lg" 
                   className="flex-1 rounded-full h-14 shadow-md gap-2"
                   onClick={handleStartRecount}
                 >
                    <Play className="w-5 h-5" />
                    Iniciar Recuento
                 </Button>
              </div>
           </motion.div>
        )}

        {status === 'counting' && (
           <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             className="space-y-6"
           >
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-muted/20 p-4 rounded-lg border border-muted/50">
                <Tabs value={filterTab} onValueChange={(v: any) => setFilterTab(v)} className="w-full md:w-auto">
                  <TabsList className="bg-background/50 p-1 h-11 ring-1 ring-border/50">
                    <TabsTrigger value="all" className="px-5 rounded-lg data-[selected]:bg-primary data-[selected]:text-white">
                      Todos ({recountItems.length})
                    </TabsTrigger>
                    <TabsTrigger value="pending" className="px-5 rounded-lg data-[selected]:bg-destructive data-[selected]:text-white">
                      Faltantes ({recountItems.filter(i => (i.counted_qty - i.systemStock) < 0).length})
                    </TabsTrigger>
                    <TabsTrigger value="counted" className="px-5 rounded-lg data-[selected]:bg-success data-[selected]:text-white">
                      Sobrantes ({recountItems.filter(i => (i.counted_qty - i.systemStock) > 0).length})
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar producto, EAN..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-11 bg-background border-border/50 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-12 gap-4 px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 mb-2">
                <div className="col-span-4 pl-10">Producto</div>
                <div className="col-span-2 text-right">Precio</div>
                <div className="col-span-2 text-center">Diferencia</div>
                <div className="col-span-2 text-center">Físico / Sistema</div>
                <div className="col-span-2 text-right pr-4">Total ($)</div>
              </div>

              <div className="h-[500px] bg-background rounded-xl border border-border/40 overflow-hidden shadow-inner relative">
                <AutoSizer>
                  {({ height, width }) => (
                    <List
                      height={height}
                      itemCount={filteredItems.length}
                      itemSize={80}
                      width={width}
                      itemData={filteredItems}
                    >
                      {RecountRow}
                    </List>
                  )}
                </AutoSizer>
                {filteredItems.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground italic">
                    No se encontraron productos con los filtros actuales
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center p-4 bg-muted/10 rounded-lg border border-muted/30">
                 <div className="flex gap-8">
                    <div>
                       <p className="text-[10px] font-bold text-muted-foreground uppercase">Controlados</p>
                       <p className="text-xl font-black text-foreground">{totalCounted} <span className="text-xs text-muted-foreground">/ {products.length}</span></p>
                    </div>
                    <div>
                       <p className="text-[10px] font-bold text-muted-foreground uppercase">Valorizado Diferencia</p>
                       <p className={cn("text-xl font-black", recountItems.reduce((acc, i) => acc + (i.counted_qty - i.systemStock) * i.cost, 0) < 0 ? "text-destructive" : "text-success")}>
                          {recountItems.reduce((acc, i) => acc + (i.counted_qty - i.systemStock) * i.cost, 0) < 0 ? "-" : "+"}${Math.abs(recountItems.reduce((acc, i) => acc + (i.counted_qty - i.systemStock) * i.cost, 0)).toLocaleString()}
                       </p>
                    </div>
                 </div>
                 
                 <div className="flex gap-3">
                    <Button variant="ghost" onClick={handleCancel} className="gap-2 text-muted-foreground hover:text-destructive transition-colors">
                       <StopCircle className="w-5 h-5" /> Cancelar
                    </Button>
                    <Button variant="default" onClick={handleFinishAndExport} className="gap-2 px-8 h-12 rounded-xl shadow-lg shadow-primary/20">
                       <DocumentText className="w-5 h-5" /> Finalizar y Generar TXT
                    </Button>
                 </div>
              </div>
           </motion.div>
        )}

      </Card>
    </div>
  );
};

