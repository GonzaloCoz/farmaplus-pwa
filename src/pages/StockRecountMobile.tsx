import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Smartphone, Laptop, CheckCircle, DocumentText, Logout, ArrowLeft, Refresh, Magnifer as Search, GraphUp as TrendingUp, GraphDown as TrendingDown, Widget as Package } from "@solar-icons/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { notify } from "@/lib/notifications";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ProductImageHover } from "@/components/ProductImageHover";

interface RecountItem {
  id: string;
  ean: string;
  product_name: string;
  lab?: string;
  system_qty: number;
  counted_qty: number;
  cost: number;
  status: 'pending' | 'counted' | 'completed';
}

export default function StockRecountMobile() {
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [items, setItems] = useState<RecountItem[]>([]);
  
  useEffect(() => {
    const savedPin = localStorage.getItem('recount_pin');
    const savedAssignment = localStorage.getItem('recount_assignment');
    if (savedPin && savedAssignment) {
        setPin(savedPin);
        setAssignmentId(savedAssignment);
        checkSessionStatus(savedPin, savedAssignment);
    }
  }, []);

  const checkSessionStatus = async (accessPin: string, assignment: string) => {
      try {
          const { data, error } = await (supabase as any)
            .from('stock_recount_sessions')
            .select('*')
            .eq('access_code', accessPin)
            .single();
            
          if (error || !data) {
              logout();
              return;
          }
          
          setSessionInfo(data);
          
          if (data.status === 'counting' || data.status === 'completed') {
              loadAssignedItems(data.id, assignment);
          } else if (data.status === 'waiting') {
              startWaitingStatusTracking(data.id, assignment);
          }
      } catch (e) {
          console.error(e);
      }
  };

  const startWaitingStatusTracking = (sId: string, aId: string) => {
      const pollInterval = setInterval(async () => {
          const { data } = await (supabase as any).from('stock_recount_sessions')
            .select('status')
            .eq('id', sId)
            .single();
          if (data && data.status === 'counting') {
              clearInterval(pollInterval);
              setSessionInfo((prev: any) => ({ ...prev, status: 'counting' }));
              loadAssignedItems(sId, aId);
          }
      }, 3000);

      const channel = supabase.channel(`session_reconnect_${sId}`)
        .on('postgres_changes', {
           event: 'UPDATE',
           schema: 'public',
           table: 'stock_recount_sessions',
           filter: `id=eq.${sId}`
        }, (payload) => {
           const newStatus = payload.new.status;
           if (newStatus === 'counting') {
               clearInterval(pollInterval);
               setSessionInfo((prev: any) => ({ ...prev, status: newStatus }));
               loadAssignedItems(sId, aId);
           }
        })
        .subscribe();

      return () => {
          clearInterval(pollInterval);
          supabase.removeChannel(channel);
      };
  };

  const loadAssignedItems = async (sessionId: string, aId: string) => {
      const { data, error } = await (supabase as any)
        .from('stock_recount_items')
        .select('id, ean, product_name, lab, system_qty, counted_qty, cost, status')
        .eq('session_id', sessionId)
        .eq('assignment_id', aId)
        .order('product_name', { ascending: true });
        
      if (!error && data) {
          setItems(data.map((d: any) => ({
              ...d,
              counted_qty: Number(d.counted_qty || 0),
              system_qty: Number(d.system_qty || 0),
              cost: Number(d.cost || 0)
          })) as RecountItem[]);
      }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 6) return;
    setIsConnecting(true);
    try {
        const { data: session } = await (supabase as any)
          .from('stock_recount_sessions')
          .select('*')
          .eq('access_code', pin)
          .single();
        if (!session || session.status !== 'waiting') {
            notify.error("Error", "PIN inválido o sesión activa");
            setIsConnecting(false);
            return;
        }
        setSessionInfo(session);
        const deviceName = `Zebra-${Math.floor(Math.random()*1000)}`;
        const deviceId = crypto.randomUUID();
        const { data: assignmentData, error: assignErr } = await (supabase as any)
          .from('stock_recount_assignments')
          .insert({ session_id: session.id, device_name: deviceName, device_id: deviceId, status: 'connected' })
          .select('id').single();
        if (assignErr) throw assignErr;
        setAssignmentId(assignmentData.id);
        localStorage.setItem('recount_pin', pin);
        localStorage.setItem('recount_assignment', assignmentData.id);
        startWaitingStatusTracking(session.id, assignmentData.id);
        notify.success("Conectado", "Esperando inicio...");
    } catch (error) {
        setIsConnecting(false);
    }
  };

  const logout = () => {
      localStorage.removeItem('recount_pin');
      localStorage.removeItem('recount_assignment');
      setPin("");
      setAssignmentId(null);
      setSessionInfo(null);
      setItems([]);
  };

  const updateItemQty = async (itemId: string, qty: number) => {
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, counted_qty: qty, status: 'counted' } : i));
      await (supabase as any)
        .from('stock_recount_items')
        .update({ counted_qty: qty, status: 'counted' })
        .eq('id', itemId);
  };

  const handleManualCheck = async (itemId: string) => {
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: 'counted' } : i));
      await (supabase as any)
        .from('stock_recount_items')
        .update({ status: 'counted' })
        .eq('id', itemId);
      notify.success("Ok", "Producto verificado");
  };

  const filteredItems = useMemo(() => {
     return items
        .filter(item => {
           const diff = item.counted_qty - item.system_qty;
           if (diff === 0) return false;
           const matchesSearch = (item.product_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                                (item.ean || '').includes(searchTerm) ||
                                (item.lab || '').toLowerCase().includes(searchTerm.toLowerCase());
           return matchesSearch;
        })
        .sort((a, b) => {
           const labComp = (a.lab || "").localeCompare(b.lab || "");
           if (labComp !== 0) return labComp;
           return (a.product_name || "").localeCompare(b.product_name || "");
        });
  }, [items, searchTerm]);

  if (!sessionInfo) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-white">
        <Button variant="ghost" className="absolute top-4 left-4 rounded-full text-white/50" onClick={() => navigate('/stock')}>
           <ArrowLeft className="w-6 h-6" />
        </Button>
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-2">
             <h2 className="text-2xl font-bold">Recuento Zebra</h2>
             <p className="text-white/40 text-sm">Ingresa el PIN de la PC</p>
          </div>
          <form onSubmit={handleConnect} className="space-y-6">
            <Input
                type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="text-center text-4xl font-mono h-16 rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/10"
            />
            <Button type="submit" className="w-full h-14 rounded-xl text-lg font-bold bg-white text-black hover:bg-white/90" disabled={pin.length !== 6 || isConnecting}>
              {isConnecting ? "Conectando..." : "Entrar"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (sessionInfo.status === 'waiting') {
      return (
         <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-white text-center">
             <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 animate-pulse">
                <Laptop className="w-10 h-10 text-white/40" />
             </div>
             <h2 className="text-2xl font-bold mb-2">Conectado</h2>
             <p className="text-white/40 mb-10 text-sm max-w-[200px]">Esperando asignación de productos...</p>
             <Button variant="ghost" onClick={logout} className="text-white/30 hover:text-white underline text-xs">Desconectar</Button>
         </div>
      );
  }

  const countedCount = items.filter(i => i.status === 'counted').length;
  const progress = items.length === 0 ? 0 : (countedCount / items.length) * 100;

  return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
          {/* Header */}
          <div className="sticky top-0 z-30 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5">
              <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center">
                        <Package className="w-4 h-4" />
                     </div>
                     <div>
                        <h1 className="font-bold text-xs uppercase tracking-widest">Recuento</h1>
                        <p className="text-[10px] text-white/40 font-mono">LIVE / {countedCount} de {items.length}</p>
                     </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={logout} className="text-white/30 hover:text-white">
                     <Logout className="w-5 h-5" />
                  </Button>
              </div>
              <div className="px-4 pb-4 space-y-3">
                 <div className="relative h-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div animate={{ width: `${progress}%` }} className="absolute inset-y-0 left-0 bg-white" />
                 </div>
                 <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <Input
                       placeholder="Buscar..."
                       className="pl-10 h-10 rounded-xl bg-white/5 border-white/5 text-sm ring-0 focus-visible:ring-1 focus-visible:ring-white/20"
                       value={searchTerm}
                       onChange={(e) => setSearchTerm(e.target.value)}
                    />
                 </div>
              </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto space-y-px bg-white/5">
             <AnimatePresence mode="popLayout">
                {filteredItems.length === 0 ? (
                    <div className="p-20 text-center text-white/20 italic text-sm">Sin pendientes</div>
                ) : (
                    filteredItems.map(item => {
                        const diff = item.counted_qty - item.system_qty;
                        const diffValue = diff * item.cost;
                        return (
                           <motion.div key={item.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                              <div className={cn(
                                 "bg-[#0a0a0a] p-4 flex flex-col gap-4 relative",
                                 item.status === 'counted' && "bg-white/[0.02]"
                              )}>
                                  {/* Line Indicator */}
                                  <div className={cn("absolute left-0 top-0 bottom-0 w-1", diff > 0 ? "bg-green-500" : "bg-red-500")} />

                                  <div className="flex gap-4">
                                      <ProductImageHover ean={item.ean} name={item.product_name}>
                                         <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center text-white/20 active:bg-white/10 transition-colors">
                                            <Package className="w-6 h-6" />
                                         </div>
                                      </ProductImageHover>
                                      <div className="flex-1 min-w-0">
                                         <h3 className="font-bold text-sm leading-tight text-white mb-1">{item.product_name}</h3>
                                         <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-mono text-white/30">{item.ean}</span>
                                            {item.lab && <span className="text-[10px] text-[#3b82f6] font-bold uppercase truncate">{item.lab}</span>}
                                         </div>
                                      </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-px bg-white/10 rounded-xl overflow-hidden border border-white/10">
                                     <div className="bg-[#0f0f0f] p-3 text-center">
                                        <p className="text-[9px] text-white/40 uppercase font-bold mb-1">Sistema</p>
                                        <p className="text-xl font-bold">{item.system_qty}</p>
                                     </div>
                                     <div className={cn("bg-[#0f0f0f] p-3 text-center", item.status === 'counted' && "bg-white/[0.05]")}>
                                        <p className="text-[9px] text-white/40 uppercase font-bold mb-1">Físico</p>
                                        <Input 
                                           type="number" inputMode="numeric"
                                           defaultValue={item.counted_qty || ''}
                                           onBlur={(e) => {
                                               const val = parseInt(e.target.value);
                                               if (!isNaN(val)) updateItemQty(item.id, val);
                                           }}
                                           className="w-full text-center font-bold text-xl h-8 bg-transparent border-none p-0 focus-visible:ring-0"
                                        />
                                     </div>
                                  </div>

                                  <div className="flex items-center justify-between">
                                     <div className="space-y-1">
                                        <div className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1", diff > 0 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500")}>
                                           {diff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                           {diff > 0 ? "+" : ""}{diff} unid.
                                        </div>
                                        <div className="text-[9px] text-white/20 font-bold uppercase tracking-widest pl-2">
                                           Dif: {diff > 0 ? "+" : "-"}${Math.abs(diffValue).toLocaleString()}
                                        </div>
                                     </div>

                                     <Button 
                                        size="icon" 
                                        onClick={() => handleManualCheck(item.id)}
                                        className={cn(
                                           "w-12 h-12 rounded-full transition-all border border-white/10 bg-transparent text-white/20 active:scale-90",
                                           item.status === 'counted' && "bg-white text-black text-white/100 border-white scale-110"
                                        )}
                                     >
                                        <CheckCircle className="w-6 h-6" />
                                     </Button>
                                  </div>
                              </div>
                           </motion.div>
                        );
                    })
                )}
             </AnimatePresence>
          </div>
      </div>
  );
}
