"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  RiHistoryLine, 
  RiFileTextLine, 
  RiUserLine, 
  RiArrowRightUpLine,
  RiArrowLeftDownLine,
  RiInformationLine,
  RiEditLine
} from "@remixicon/react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface AdjustmentSession {
  id: string;
  created_at: string;
  user_name: string;
  adjustment_id_shortage?: string;
  adjustment_id_surplus?: string;
  shortage_value: number;
  surplus_value: number;
  total_units_adjusted: number;
  category?: string;
}

interface HistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: AdjustmentSession[];
  onEditIds?: (session: AdjustmentSession) => void;
}

export function HistoryDialog({
  open,
  onOpenChange,
  history,
  onEditIds,
}: HistoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border-none shadow-md bg-background  rounded-xl">
        <DialogHeader className="px-8 pt-8 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <RiHistoryLine size={24} />
            </div>
            <DialogTitle className="text-2xl font-bold tracking-tight">Historial de Ajustes</DialogTitle>
          </div>
        </DialogHeader>

        <div className="px-2 pb-8">
          <ScrollArea className="h-[450px] px-6">
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <div className="p-4 rounded-full bg-muted/30">
                  <RiInformationLine size={40} className="text-muted-foreground/40" />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-medium text-foreground/80">No hay ajustes registrados</p>
                  <p className="text-sm text-muted-foreground">Las sesiones de ajuste de este laboratorio aparecerán aquí.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pr-4">
                {history.map((session) => (
                  <div 
                    key={session.id}
                    className="group relative p-5 rounded-lg bg-muted/20 border border-border/40 hover:bg-muted/40 transition-all duration-200"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {format(new Date(session.created_at), "d 'de' MMMM, HH:mm", { locale: es })}
                          </span>
                          <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider py-0 px-1.5 rounded-md bg-background/50 border-border/50">
                            {session.category || "General"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <RiUserLine size={12} />
                          <span>{session.user_name}</span>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-lg font-bold text-foreground">
                          {session.total_units_adjusted} <span className="text-xs font-normal text-muted-foreground">unids</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600/80 uppercase tracking-wider mb-1">
                          <RiArrowLeftDownLine size={12} />
                          Sobrantes
                        </div>
                        <div className="text-sm font-bold text-emerald-600">
                          + ${session.surplus_value.toLocaleString("es-AR")}
                        </div>
                        {session.adjustment_id_surplus && (
                          <div className="text-[10px] text-muted-foreground font-mono mt-1 opacity-60">
                            ID: {session.adjustment_id_surplus}
                          </div>
                        )}
                      </div>
                      
                      <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/10">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-orange-600/80 uppercase tracking-wider mb-1">
                          <RiArrowRightUpLine size={12} />
                          Faltantes
                        </div>
                        <div className="text-sm font-bold text-orange-600">
                          - ${session.shortage_value.toLocaleString("es-AR")}
                        </div>
                        {session.adjustment_id_shortage && (
                          <div className="text-[10px] text-muted-foreground font-mono mt-1 opacity-60">
                            ID: {session.adjustment_id_shortage}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-border/30">
                      <div className="text-[10px] text-muted-foreground italic">
                        ID Sistema: {session.id.substring(0, 8)}...
                      </div>
                      <div className="flex gap-2">
                        {onEditIds && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => onEditIds(session)}
                            className="h-7 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/10 hover:text-primary transition-colors"
                          >
                            <RiEditLine size={14} className="mr-1.5" />
                            Editar IDs
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold uppercase tracking-wider hover:bg-primary/10 hover:text-primary transition-colors">
                          <RiFileTextLine size={14} className="mr-1.5" />
                          Ver Detalles
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

