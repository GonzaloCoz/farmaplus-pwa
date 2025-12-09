import { useEffect, useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Search, ArrowUp, ArrowDown, Check, Clock, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface ResultItem {
  id: string;
  title: string;
  url: string;
  type: "page" | "report" | "product" | "branch" | "other";
  sku?: string;
}

const STATIC_INDEX: ResultItem[] = [
  { id: "dashboard", title: "Dashboard", url: "/", type: "page" },
  { id: "import", title: "Importar Inventario", url: "/import", type: "page" },
  { id: "cyclic", title: "Inventarios Cíclicos", url: "/cyclic", type: "page" },
  { id: "products", title: "Productos", url: "/products", type: "page" },
  { id: "reports", title: "Reportes", url: "/reports", type: "page" },
  { id: "settings", title: "Configuración", url: "/settings", type: "other" },
];

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [results, setResults] = useState<ResultItem[]>(STATIC_INDEX);
  const [recentSearches, setRecentSearches] = useState<ResultItem[]>([]);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("recent-searches");
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        // ignore
      }
    }

    function onKey(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      if ((isMac && e.metaKey && e.key === "k") || (!isMac && e.ctrlKey && e.key === "k")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setActiveIndex(0);
      setResults(STATIC_INDEX);
    }
  }, [open]);

  const addToRecent = (item: ResultItem) => {
    const newRecent = [item, ...recentSearches.filter(r => r.id !== item.id)].slice(0, 5);
    setRecentSearches(newRecent);
    localStorage.setItem("recent-searches", JSON.stringify(newRecent));
  };

  const removeRecent = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newRecent = recentSearches.filter(r => r.id !== id);
    setRecentSearches(newRecent);
    localStorage.setItem("recent-searches", JSON.stringify(newRecent));
  };

  const runSearch = useCallback(async (q: string) => {
    if (!q) {
      setResults(STATIC_INDEX);
      return;
    }

    const qtrim = q.trim();
    const candidates: ResultItem[] = [];

    try {
      const { data: products, error: prodError } = await supabase
        .from("products")
        .select("id,name,sku,slug")
        .or(`name.ilike.%${qtrim}%,sku.ilike.%${qtrim}%`)
        .limit(5);

      if (!prodError && Array.isArray(products)) {
        for (const p of products as any[]) {
          candidates.push({
            id: String(p.id),
            title: p.name ?? p.title ?? `Producto ${p.id}`,
            url: `/products/${p.slug ?? p.id}`,
            type: "product",
            sku: p.sku,
          });
        }
      }
    } catch (e) {
      // ignore
    }

    try {
      const { data: branches, error: brError } = await supabase
        .from("branches")
        .select("id,name,slug")
        .ilike("name", `%${qtrim}%`)
        .limit(3);
      if (!brError && Array.isArray(branches)) {
        for (const b of branches as any[]) {
          candidates.push({ id: String(b.id), title: b.name, url: `/branches/${b.slug ?? b.id}`, type: "branch" });
        }
      }
    } catch (e) {
      // ignore
    }

    const pages = STATIC_INDEX.filter(p => p.title.toLowerCase().includes(qtrim.toLowerCase()) || p.url.includes(qtrim));
    const combined = [...candidates, ...pages];
    setResults(combined.length ? combined : []);
  }, []);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => runSearch(query), 180);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [query, runSearch]);

  function renderHighlighted(text: string, q: string) {
    if (!q) return text;
    const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")})`, "ig"));
    return (
      <>
        {parts.map((part, i) => (
          new RegExp(q, "i").test(part) ? <mark key={i} className="bg-yellow-200 rounded text-black">{part}</mark> : <span key={i}>{part}</span>
        ))}
      </>
    );
  }

  async function onChoose(item: ResultItem) {
    addToRecent(item);
    setOpen(false);
    if (item.type === "product") {
      try {
        await supabase.from("products").select("*").eq("id", item.id).limit(1);
      } catch (e) {
        // ignore
      }
    }
    navigate(item.url);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const list = query ? results : (recentSearches.length > 0 ? recentSearches : results);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, list.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = list[activeIndex];
      if (item) onChoose(item);
    }
  }

  const showRecent = !query && recentSearches.length > 0;
  const displayList = query ? results : (showRecent ? recentSearches : results);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl w-full p-0 gap-0 overflow-hidden rounded-xl">
        <DialogHeader className="p-4 border-b bg-muted/30">
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <span>Buscar</span>
          </DialogTitle>
        </DialogHeader>
        <div className="p-2">
          <Input
            ref={inputRef}
            placeholder="Buscar productos, sucursales, reportes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            className="border-0 shadow-none focus-visible:ring-0 text-lg h-12"
          />
        </div>

        <div className="max-h-[60vh] overflow-auto border-t">
          {showRecent && (
            <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/20">
              Búsquedas recientes
            </div>
          )}

          {displayList.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No se encontraron resultados para "{query}"</p>
            </div>
          )}

          <ul className="divide-y divide-border/50">
            {displayList.map((r, idx) => (
              <li key={`${r.type}-${r.id}`}>
                <button
                  onClick={() => onChoose(r)}
                  className={cn(
                    "w-full text-left p-4 flex items-center gap-4 transition-colors",
                    idx === activeIndex ? "bg-accent" : "hover:bg-accent/50"
                  )}
                  onMouseEnter={() => setActiveIndex(idx)}
                >
                  <div className={cn(
                    "p-2 rounded-full flex-shrink-0",
                    r.type === 'product' ? "bg-blue-100 text-blue-600" :
                      r.type === 'branch' ? "bg-green-100 text-green-600" :
                        "bg-gray-100 text-gray-600"
                  )}>
                    {showRecent ? <Clock className="w-4 h-4" /> : <Search className="w-4 h-4" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{renderHighlighted(r.title, query)}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {r.sku ? `${r.sku} · ` : ""}{r.type === 'page' ? 'Página' : r.type}
                    </div>
                  </div>

                  {showRecent && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => removeRecent(e, r.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}

                  {idx === activeIndex && !showRecent && <Check className="w-4 h-4 text-primary" />}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-2 border-t bg-muted/30 text-xs text-muted-foreground flex justify-between px-4">
          <div className="flex gap-2">
            <span><kbd className="bg-background border rounded px-1">↓</kbd> <kbd className="bg-background border rounded px-1">↑</kbd> navegar</span>
            <span><kbd className="bg-background border rounded px-1">↵</kbd> seleccionar</span>
          </div>
          <span><kbd className="bg-background border rounded px-1">Esc</kbd> cerrar</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
