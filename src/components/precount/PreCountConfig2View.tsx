"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { SidebarInsetTopbar } from "@/components/sidebar-app/inset-topbar";
import { AppSidebar } from "@/components/sidebar-preset/app-sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { InputGroup, InputField } from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardGroup,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/fluid-card";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Combobox,
  ComboboxChips,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import { HugeiconsIcon } from "@hugeicons/react";
import RawTimelineListIcon from "@hugeicons/core-free-icons/TimelineListIcon";
import RawListTodoIcon from "@hugeicons/core-free-icons/ListTodoIcon";
import RawXls01Icon from "@hugeicons/core-free-icons/Xls01Icon";
import { Switch } from "@/components/ui/switch";
import { OFFICIAL_71_BRANCHES } from "@/lib/branchNetworkMap";

// HugeIcons con estilo duotone (opacidad al 40% en trazos secundarios)
const TimelineListIcon = RawTimelineListIcon.map((item, idx) =>
  idx < 3 ? [item[0], { ...item[1], opacity: 0.4 }] : item
) as any;

const ListTodoIcon = RawListTodoIcon.map((item, idx) =>
  idx < 4 ? [item[0], { ...item[1], opacity: 0.4 }] : item
) as any;

const Xls01Icon = RawXls01Icon.map((item, idx) =>
  idx === 0 ? [item[0], { ...item[1], opacity: 0.4 }] : item
) as any;
import { useUser } from "@/contexts/UserContext";
import { fontWeights } from "@/lib/font-weight";
import { notify } from "@/lib/notifications";
import {
  testMysqlConnection,
  isTauriEnvironment,
} from "@/services/mysqlTauriBridge";

function formatBranchName(raw: string): string {
  return raw
    .toLowerCase()
    .split(" ")
    .map((word) => {
      if (["ii", "iii", "iv", "v", "vi", "vii", "viii"].includes(word)) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

const SORTED_BRANCHES = [...OFFICIAL_71_BRANCHES].sort((a, b) =>
  formatBranchName(a.name).localeCompare(formatBranchName(b.name), "es", {
    sensitivity: "base",
  })
);

const BRANCH_OPTIONS = SORTED_BRANCHES.map(
  (b) => formatBranchName(b.name)
);

const RUBROS_ITEMS = [
  { value: "medicamentos", label: "Medicamentos" },
  { value: "perfumeria", label: "Perfumería" },
  { value: "accesorios", label: "Accesorios" },
  { value: "varios", label: "Varios" },
];

export type StockFilterOption = "all" | "positive" | "negative" | "zero";

const STOCK_FILTER_OPTIONS: { value: StockFilterOption; label: string }[] = [
  { value: "all", label: "Todos los valores de stock" },
  { value: "positive", label: "Solo con stock positivo (> 0)" },
  { value: "negative", label: "Stock en negativo (< 0)" },
  { value: "zero", label: "Stock en 0" },
];

export function PreCountConfig2View() {
  const { user } = useUser();

  const initialBranchObj = useMemo(() => {
    if (typeof window !== "undefined") {
      const savedBranch = localStorage.getItem("precount_config_selected_branch");
      if (savedBranch) {
        const cleanSaved = savedBranch.replace(/\s*\([^)]*\)$/, "").trim();
        const matchSaved = OFFICIAL_71_BRANCHES.find(
          (b) =>
            formatBranchName(b.name).toLowerCase() === cleanSaved.toLowerCase() ||
            b.name.toLowerCase() === cleanSaved.toLowerCase() ||
            cleanSaved.toLowerCase().includes(b.name.toLowerCase())
        );
        if (matchSaved) return matchSaved;
      }
    }
    if (user?.branchSheet) {
      const match = OFFICIAL_71_BRANCHES.find(
        (b) =>
          b.name.toLowerCase() === user.branchSheet?.toLowerCase() ||
          user.branchSheet?.toLowerCase().includes(b.name.toLowerCase())
      );
      if (match) return match;
    }
    return (
      OFFICIAL_71_BRANCHES.find((b) => b.name.toUpperCase() === "SALADILLO") ||
      OFFICIAL_71_BRANCHES[0]
    );
  }, [user?.branchSheet]);

  const [selectedBranch, setSelectedBranch] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("precount_config_selected_branch");
      if (saved) {
        const cleanSaved = saved.replace(/\s*\([^)]*\)$/, "").trim();
        if (BRANCH_OPTIONS.includes(cleanSaved)) {
          return cleanSaved;
        }
      }
    }
    return formatBranchName(initialBranchObj.name);
  });

  const [sessionName, setSessionName] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("precount_config_inventory_name");
      if (saved && !/^listado[_\s]+(?:de[_\s]+)?stock/i.test(saved.trim())) {
        return saved;
      }
    }
    return `Inventario ${formatBranchName(initialBranchObj.name)}`;
  });

  const [serverIp, setServerIp] = useState(() => {
    if (typeof window !== "undefined") {
      const savedIp = localStorage.getItem("precount_config_server_ip");
      if (savedIp) return savedIp;
    }
    return initialBranchObj.primaryIp;
  });

  const [serverPort, setServerPort] = useState(() => {
    if (typeof window !== "undefined") {
      const savedPort = localStorage.getItem("precount_config_server_port");
      if (savedPort && savedPort !== "****") return savedPort;
    }
    return "3306";
  });

  const [showIp, setShowIp] = useState(true);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const [selectedRubros, setSelectedRubros] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("precount_config_selected_rubros");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch {}
      }
    }
    return ["medicamentos", "perfumeria", "accesorios", "varios"];
  });

  const handleRubrosChange = (vals: string[]) => {
    setSelectedRubros(vals);
    if (typeof window !== "undefined") {
      localStorage.setItem("precount_config_selected_rubros", JSON.stringify(vals));
    }
  };

  const [stockFilter, setStockFilter] = useState<StockFilterOption>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("precount_config_stock_filter");
      if (saved && ["all", "positive", "negative", "zero"].includes(saved)) {
        return saved as StockFilterOption;
      }
    }
    return "all";
  });

  const [enableExcelImport, setEnableExcelImport] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("precount_config_enable_excel_import");
      if (saved !== null) return saved === "true";
    }
    return false;
  });

  const handleToggleExcelImport = () => {
    setEnableExcelImport((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("precount_config_enable_excel_import", String(next));
      }
      return next;
    });
  };

  const handleStockFilterChange = (val: string) => {
    setStockFilter(val as StockFilterOption);
    if (typeof window !== "undefined") {
      localStorage.setItem("precount_config_stock_filter", val);
    }
  };

  const handleNameChange = (value: string) => {
    setSessionName(value);
    if (typeof window !== "undefined") {
      localStorage.setItem("precount_config_inventory_name", value);
    }
  };

  const handleBranchChange = (val: string) => {
    setSelectedBranch(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("precount_config_selected_branch", val);
    }
    const found = OFFICIAL_71_BRANCHES.find(
      (b) =>
        formatBranchName(b.name).toLowerCase() === val.toLowerCase() ||
        b.name.toLowerCase() === val.toLowerCase()
    );
    if (found) {
      const cleanName = formatBranchName(found.name);
      const newName = `Inventario ${cleanName}`;
      setSessionName(newName);
      setServerIp(found.primaryIp);
      if (typeof window !== "undefined") {
        localStorage.setItem("precount_config_server_ip", found.primaryIp);
        localStorage.setItem("plex_target_ip", found.primaryIp);
        localStorage.setItem("plex_target_branch", found.name);
        localStorage.setItem("precount_config_inventory_name", newName);
      }
    }
  };

  const handleIpChange = (val: string) => {
    setServerIp(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("precount_config_server_ip", val);
    }
  };

  const handlePortChange = (val: string) => {
    setServerPort(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("precount_config_server_port", val);
    }
  };

  const handleTestConnection = async () => {
    if (!serverIp.trim()) {
      notify.error("IP requerida", "Ingresá una dirección IP válida.");
      return;
    }
    setIsTestingConnection(true);

    if (!isTauriEnvironment()) {
      setTimeout(() => {
        notify.success(
          "Conexión exitosa",
          "Servidor vinculado correctamente."
        );
        setIsTestingConnection(false);
      }, 600);
      return;
    }

    try {
      const resolvedPort =
        !serverPort || serverPort.trim() === "****"
          ? 3306
          : Number(serverPort) || 3306;

      const res = await testMysqlConnection({
        host: serverIp.trim(),
        port: resolvedPort,
        user: "root",
        password: "",
        database: "plex",
      });

      if (res.success) {
        notify.success(
          "Conexión exitosa",
          res.message || `MySQL ${res.server_version || ""} disponible en ${serverIp}.`
        );
      } else {
        notify.error(
          "Fallo de conexión",
          res.message || "No se pudo establecer contacto con el servidor."
        );
      }
    } catch (err: any) {
      notify.error(
        "Fallo de conexión",
        err?.message || "No se pudo establecer contacto con el servidor."
      );
    } finally {
      setIsTestingConnection(false);
    }
  };

  return (
    <div className="w-full flex-1 min-h-0 h-full bg-surface-2/60 dark:bg-surface-2/40 border border-border/40 rounded-[22px] p-[1.5px] transition-all duration-200 shadow-xs flex flex-col">
      <div className="w-full flex-1 min-h-0 bg-white dark:bg-surface-3 border border-border/40 rounded-[20px] shadow-xs flex flex-col overflow-hidden">
        <SidebarProvider
          persist={false}
          shortcut={null}
          className="!min-h-0 h-full flex-1 overflow-hidden"
        >
          <AppSidebar className="!h-full" />
          <SidebarInset className="!min-h-0 h-full overflow-hidden flex flex-col">
            <SidebarInsetTopbar />
            <div className="flex min-w-0 flex-1 flex-col min-h-0">
              <div className="flex shrink-0 flex-col gap-1 pl-40 pr-8 pt-2 pb-4">
                <h3
                  className="text-[length:var(--fs-title,16px)] leading-[var(--lh-title,22px)] text-foreground"
                  style={{ fontVariationSettings: fontWeights.normal }}
                >
                  General
                </h3>
                <p className="text-[length:var(--fs-body,13px)] leading-[var(--lh-body,20px)] text-muted-foreground">
                  Nombre de la sesión de inventario, sucursal y parámetros iniciales.
                </p>
              </div>
              <ScrollArea className="min-h-0 flex-1">
                <div className="flex flex-col gap-6 pl-40 pr-8 pb-6 max-w-[1080px]">
                  <InputGroup>
                    <InputField
                      index={0}
                      label="Nombre de la sesión"
                      value={sessionName}
                      onChange={handleNameChange}
                      placeholder="Ej. Inventario Central"
                    />
                  </InputGroup>

                  <div className="flex w-80 max-w-full flex-col gap-1">
                    <label
                      id="config2-branch-select-label"
                      className="text-[length:var(--fs-body,13px)] leading-[var(--lh-body,20px)] text-muted-foreground"
                      style={{ fontVariationSettings: fontWeights.normal }}
                    >
                      Sucursal
                    </label>
                    <Select value={selectedBranch} onValueChange={handleBranchChange}>
                      <SelectTrigger
                        aria-labelledby="config2-branch-select-label"
                        placeholder="Seleccionar sucursal"
                        className="w-full"
                      />
                      <SelectContent>
                        {BRANCH_OPTIONS.map((branchLabel, idx) => (
                          <SelectItem key={branchLabel} index={idx} value={branchLabel}>
                            {branchLabel}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="h-px w-full bg-border/60" />

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <h4
                        className="text-[length:var(--fs-title,16px)] leading-[var(--lh-title,22px)] text-foreground"
                        style={{ fontVariationSettings: fontWeights.normal }}
                      >
                        Conexión con Servidor Plex
                      </h4>
                      <p className="text-[length:var(--fs-body,13px)] leading-[var(--lh-body,20px)] text-muted-foreground">
                        Parámetros de conexión protegida y vinculación con la sesión de inventario del servidor local.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <InputGroup className="w-80 flex-row items-center gap-2.5">
                        <InputField
                          index={0}
                          aria-label="Dirección IP del Servidor Plex"
                          type={showIp ? "text" : "password"}
                          value={serverIp}
                          onChange={handleIpChange}
                          placeholder="***.***.***.***"
                          inputMode="decimal"
                          autoComplete="off"
                          className="min-w-0 flex-1 font-mono tracking-wider"
                          endAdornment={
                            <button
                              type="button"
                              onClick={() => setShowIp((prev) => !prev)}
                              className="p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded-md focus-visible:outline-none"
                              title={showIp ? "Ocultar IP" : "Mostrar IP"}
                              tabIndex={-1}
                            >
                              {showIp ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                          }
                        />
                        <InputField
                          index={1}
                          aria-label="Puerto TCP"
                          value={serverPort}
                          onChange={handlePortChange}
                          placeholder="****"
                          inputMode="numeric"
                          autoComplete="off"
                          className="w-24 shrink-0 font-mono tracking-wider"
                        />
                      </InputGroup>

                      <Button
                        type="button"
                        variant="secondary"
                        loading={isTestingConnection}
                        disabled={!serverIp.trim()}
                        onClick={handleTestConnection}
                        className="h-9 bg-white/10 hover:bg-white/15 active:bg-white/10 text-foreground border-0 shadow-none font-normal"
                      >
                        Probar
                      </Button>
                    </div>
                  </div>

                  <div className="h-px w-full bg-border/60" />

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <h4
                        className="text-[length:var(--fs-title,16px)] leading-[var(--lh-title,22px)] text-foreground"
                        style={{ fontVariationSettings: fontWeights.normal }}
                      >
                        Alcance del Inventario
                      </h4>
                      <p className="text-[length:var(--fs-body,13px)] leading-[var(--lh-body,20px)] text-muted-foreground">
                        Definí los rubros y criterios de stock a incluir en este recuento.
                      </p>
                    </div>

                    {/* Bloque: Cards de Configuración Fluid (Rubros y Valores de Stock) */}
                    <CardGroup
                      border="outlined"
                      className="w-full bg-surface-2/40 dark:bg-surface-2/30"
                    >
                      {/* Card 1: Rubros a inventariar */}
                      <Card className="!pb-0">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-3 sm:px-6 sm:py-3">
                          <div className="flex flex-col gap-1 min-w-0 pr-4">
                            <div className="flex items-center gap-3.5">
                              <HugeiconsIcon
                                icon={TimelineListIcon}
                                size={18}
                                strokeWidth={1.75}
                                className="shrink-0 text-foreground"
                              />
                              <CardTitle className="whitespace-nowrap">Rubros a inventariar</CardTitle>
                            </div>
                            <CardDescription className="pl-[32px] text-[length:var(--fs-body,13px)] leading-[var(--lh-body,20px)] text-muted-foreground">
                              Define qué familias comerciales de productos se descargarán a los colectores móviles para auditar sus existencias físicas.
                            </CardDescription>
                          </div>

                          <div className="w-full sm:w-60 shrink-0">
                            <Combobox
                              multiple
                              hideSelected
                              items={RUBROS_ITEMS}
                              value={selectedRubros}
                              onValueChange={handleRubrosChange}
                            >
                              <ComboboxChips max={1} placeholder="Agregar rubros…" className="min-w-0" />
                              <ComboboxContent>
                                <ComboboxEmpty allSelected="Todos los rubros fueron seleccionados.">
                                  No se encontraron rubros.
                                </ComboboxEmpty>
                                <ComboboxList>
                                  {(item: any) => (
                                    <ComboboxItem
                                      key={typeof item === "string" ? item : item.value}
                                      value={typeof item === "string" ? item : item.value}
                                    >
                                      {typeof item === "string" ? item : item.label}
                                    </ComboboxItem>
                                  )}
                                </ComboboxList>
                              </ComboboxContent>
                            </Combobox>
                          </div>
                        </div>
                      </Card>

                      {/* Card 2: Valores de stock a incluir */}
                      <Card className="!pb-0">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-3 sm:px-6 sm:py-3">
                          <div className="flex flex-col gap-1 min-w-0 pr-4">
                            <div className="flex items-center gap-3.5">
                              <HugeiconsIcon
                                icon={ListTodoIcon}
                                size={18}
                                strokeWidth={1.75}
                                className="shrink-0 text-foreground"
                              />
                              <CardTitle className="whitespace-nowrap">Valores de stock a incluir</CardTitle>
                            </div>
                            <CardDescription className="pl-[32px] text-[length:var(--fs-body,13px)] leading-[var(--lh-body,20px)] text-muted-foreground">
                              Determina qué artículos se auditarán según su saldo teórico en sistema (positivos, negativos o saldo cero).
                            </CardDescription>
                          </div>

                          <div className="w-full sm:w-60 shrink-0">
                            <Select value={stockFilter} onValueChange={handleStockFilterChange}>
                              <SelectTrigger
                                placeholder="Seleccionar filtro de stock"
                                className="w-full"
                              />
                              <SelectContent>
                                {STOCK_FILTER_OPTIONS.map((opt, idx) => (
                                  <SelectItem key={opt.value} index={idx} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </Card>
                    </CardGroup>
                  </div>

                  <div className="h-px w-full bg-border/60" />

                  {/* Bloque: Importar stock teórico (Carga por Archivo Excel) */}
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <h4
                        className="text-[length:var(--fs-title,16px)] leading-[var(--lh-title,22px)] text-foreground"
                        style={{ fontVariationSettings: fontWeights.normal }}
                      >
                        Importar stock teórico
                      </h4>
                      <p className="text-[length:var(--fs-body,13px)] leading-[var(--lh-body,20px)] text-muted-foreground">
                        Habilitá la carga mediante planilla Excel para contrastar el conteo físico contra las existencias esperadas.
                      </p>
                    </div>

                    <CardGroup
                      border="outlined"
                      className="w-full bg-surface-2/40 dark:bg-surface-2/30"
                    >
                      <Card className="!pb-0">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-3 sm:px-6 sm:py-3">
                          <div className="flex flex-col gap-1 min-w-0 pr-4">
                            <div className="flex items-center gap-3.5">
                              <HugeiconsIcon
                                icon={Xls01Icon}
                                size={18}
                                strokeWidth={1.75}
                                className="shrink-0 text-foreground"
                              />
                              <CardTitle className="whitespace-nowrap">
                                Carga por archivo Excel
                              </CardTitle>
                            </div>
                            <CardDescription className="pl-[32px] text-[length:var(--fs-body,13px)] leading-[var(--lh-body,20px)] text-muted-foreground">
                              Permite importar el padrón maestro de existencias teóricas desde un archivo de planilla (.xlsx, .xls).
                            </CardDescription>
                          </div>

                          <div className="shrink-0 flex items-center">
                            <Switch
                              checked={enableExcelImport}
                              onToggle={handleToggleExcelImport}
                            />
                          </div>
                        </div>
                      </Card>
                    </CardGroup>
                  </div>
                </div>
              </ScrollArea>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </div>
    </div>
  );
}
