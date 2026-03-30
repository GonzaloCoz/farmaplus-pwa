import { Search, Mic, Command } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

interface GlobalSearchInputProps {
  onClick?: () => void;
  className?: string;
}

export function GlobalSearchInput({ onClick, className }: GlobalSearchInputProps) {
  return (
    <div
      className={cn(
        "w-full max-w-2xl mx-auto group cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <InputGroup className="h-12 rounded-2xl border-input bg-background/50 backdrop-blur-sm shadow-sm shadow-black/5 dark:shadow-white/5 group-hover:bg-background transition-all duration-300">
        <InputGroupAddon>
          <Search className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors duration-300" strokeWidth={1.5} />
        </InputGroupAddon>
        
        <InputGroupInput
          readOnly
          placeholder="Buscar productos, reportes, sucursales..."
          className="text-muted-foreground/80 font-medium"
        />

        <InputGroupAddon align="inline-end" className="gap-2">
          <div className="hidden sm:flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
            <Kbd className="bg-muted/50 border-none px-1.5 h-6 text-[10px] flex items-center gap-0.5">
              <Command className="w-3 h-3" strokeWidth={1.5} />
              K
            </Kbd>
          </div>
          <button 
            className="p-1 hover:bg-muted rounded-md transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              // Future: Voice Search
            }}
          >
            <Mic className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
          </button>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
