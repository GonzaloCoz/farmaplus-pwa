import React from 'react';
import { Monitor, Smartphone, Wifi, Clock } from 'lucide-react';
import { ConnectedDevice } from '@/hooks/usePreCount';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface ConnectedDevicesListProps {
  devices: ConnectedDevice[];
  className?: string;
}

export function ConnectedDevicesList({ devices, className }: ConnectedDevicesListProps) {
  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="flex items-center justify-between p-4 border-b border-border/10 bg-muted/5">
        <div className="flex items-center gap-2">
          <Wifi className="size-4 text-primary animate-pulse" />
          <h3 className="font-bold text-sm tracking-tight text-foreground">Terminales Conectadas</h3>
        </div>
        <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
          {devices.length} {devices.length === 1 ? 'ACTIVA' : 'ACTIVAS'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {devices.length > 0 ? (
          <div className="divide-y divide-border/10">
            {devices.map((device) => {
              const isZebra = device.deviceName.toLowerCase().includes('zebra') || device.deviceId.startsWith('dev-');
              
              return (
                <div 
                  key={device.deviceId} 
                  className="p-4 hover:bg-accent/20 transition-all flex items-center justify-between group animate-in fade-in slide-in-from-right-4 duration-300"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Avatar/Icon - Matches Product List aesthetic */}
                    <div className="size-12 rounded-full bg-muted flex items-center justify-center border border-border/50 shadow-sm group-hover:border-primary/30 transition-colors shrink-0 overflow-hidden relative">
                      {isZebra ? (
                        <Smartphone className="size-6 text-primary/70" />
                      ) : (
                        <Monitor className="size-6 text-indigo-500/70" />
                      )}
                      {/* Online dot indicator */}
                      <div className="absolute bottom-1 right-1 size-2.5 rounded-full bg-emerald-500 border-2 border-background shadow-sm" />
                    </div>

                    <div className="flex flex-col min-w-0">
                      <h4 className="font-bold text-sm leading-tight text-foreground group-hover:text-primary transition-colors truncate">
                        {device.deviceName}
                      </h4>
                      <p className="text-[10px] font-mono text-muted-foreground mt-0.5 flex items-center gap-1.5 grayscale opacity-70">
                        <span className="px-1 py-0.5 bg-muted/50 rounded border border-border/40">
                          {device.deviceId.substring(0, 12)}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 ml-4 shrink-0">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">En Línea</span>
                    </div>
                    <div className="flex items-center gap-1 text-[9px] text-muted-foreground font-medium italic opacity-60">
                      <Clock className="size-2.5" />
                      <span>
                        unido hace {formatDistanceToNow(device.joinedAt, { locale: es })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-4 opacity-40">
            <div className="p-4 rounded-full bg-muted/50 border border-dashed border-border/80">
              <Wifi className="size-10 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold">Esperando terminales...</p>
              <p className="text-[10px] leading-relaxed max-w-[200px]">
                En cuanto una Zebra o PC Salón ingrese el PIN de verificación, aparecerá automáticamente en esta lista.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
