import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Search, ArrowUp, ArrowDown, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
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

  const runSearch = useCallback(async (q: string) => {
    // If empty, return static index
    if (!q) {
      setResults(STATIC_INDEX);
      return;
    }

    const qtrim = q.trim();
    const candidates: ResultItem[] = [];

    // Try to query products table (graceful fallback if not available)
    try {
      const { data: products, error: prodError } = await supabase
        .from("products")
        .select("id,name,sku,slug")
        .or(`name.ilike.%${qtrim}%,sku.ilike.%${qtrim}%`)
        .limit(10);

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
      // ignore and continue with static/pages
    }

    // Try branches/locations
    try {
      const { data: branches, error: brError } = await supabase
        .from("branches")
        .select("id,name,slug")
        .ilike("name", `%${qtrim}%`)
        .limit(8);
      if (!brError && Array.isArray(branches)) {
        for (const b of branches as any[]) {
          candidates.push({ id: String(b.id), title: b.name, url: `/branches/${b.slug ?? b.id}`, type: "branch" });
        }
      }
    } catch (e) {
      // ignore
    }

    // Combine with static pages and filter duplicates
    const pages = STATIC_INDEX.filter(p => p.title.toLowerCase().includes(qtrim.toLowerCase()) || p.url.includes(qtrim));
    const combined = [...candidates, ...pages];
    setResults(combined.length ? combined : []);
  }, []);

  // Debounced search effect
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => runSearch(query), 180);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [query, runSearch]);

  // highlight helper
  function renderHighlighted(text: string, q: string) {
    if (!q) return text;
    const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")})`, "ig"));
    return (
      <>
        {parts.map((part, i) => (
          new RegExp(q, "i").test(part) ? <mark key={i} className="bg-yellow-200 rounded">{part}</mark> : <span key={i}>{part}</span>
        ))}
      </>
    );
  }

  async function onChoose(item: ResultItem) {
    setOpen(false);
    // prefetch product details if product
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
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[activeIndex];
      if (item) onChoose(item);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl w-full p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <span>Buscar (Ctrl/Cmd+K)</span>
          </DialogTitle>
        </DialogHeader>
        <div className="p-4">
          <Input
            ref={inputRef}
            placeholder="Buscar productos, sucursales o reportes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            className="mb-3"
          />
          <div className="max-h-64 overflow-auto">
            {results.length === 0 && (
              <div className="p-3 text-sm text-muted-foreground">No se encontraron resultados</div>
            )}
            <ul className="divide-y">
              {results.map((r, idx) => (
                <li key={`${r.type}-${r.id}`}>
                  <button
                    onClick={() => onChoose(r)}
                    className={cn(
                      "w-full text-left p-3 flex items-center gap-3 hover:bg-accent/50",
                      idx === activeIndex ? "bg-accent/50" : ""
                    )}
                    onMouseEnter={() => setActiveIndex(idx)}
                    aria-current={idx === activeIndex}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{renderHighlighted(r.title, query)}</div>
                      <div className="text-xs text-muted-foreground">{r.sku ? `${r.sku} · ${r.url}` : r.url}</div>
                    </div>
                    <div className="px-2 text-xs rounded-md text-muted-foreground">{r.type}</div>
                    {idx === activeIndex && <Check className="w-4 h-4 text-primary" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
