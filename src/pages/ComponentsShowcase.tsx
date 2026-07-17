import { useState } from "react";
import {
  Plus,
  Settings01 as SettingsIcon,
  Bell01 as BellIcon,
  SearchLg as SearchIcon,
  ChevronDown,
  User01 as UserIcon,
  Home01 as HomeIcon,
  Mail01 as MailIcon,
  Star01 as StarIcon,
  Trash01 as TrashIcon,
  Edit01 as EditIcon,
  Download01 as DownloadIcon,
  Upload01 as UploadIcon,
} from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { RadioGroup, RadioItem } from "@/components/ui/radio-group";
import { Elevated } from "@/lib/elevated";
import { SurfaceProvider } from "@/lib/surface-context";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownLabel,
  DropdownSeparator,
  MenuItem,
} from "@/components/ui/dropdown";

// ─── Layout helpers ────────────────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 pb-3 border-b border-border/50">
        <h2 className="text-[15px] font-semibold text-foreground tracking-tight">{title}</h2>
        {description && (
          <p className="text-[13px] text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  );
}

function Row({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-[0.1em]">
          {label}
        </span>
      )}
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

// ─── Elevation Demo ────────────────────────────────────────────────────────────

function ElevationDemo() {
  const levels = [1, 2, 3, 4, 5] as const;
  return (
    <SurfaceProvider value={1}>
      <div className="flex flex-wrap gap-3">
        {levels.map((level) => (
          <Elevated
            key={level}
            offset={level}
            className="flex flex-col gap-1 p-4 rounded-xl w-24 h-24 items-center justify-center"
          >
            <span className="text-[11px] font-semibold text-foreground">Level {level}</span>
            <span className="text-[10px] text-muted-foreground/60">surface-{level}</span>
          </Elevated>
        ))}
      </div>
    </SurfaceProvider>
  );
}

// ─── Main Showcase ─────────────────────────────────────────────────────────────

const NAV_TABS = [
  { value: "buttons", label: "Buttons" },
  { value: "tabs", label: "Tabs" },
  { value: "forms", label: "Forms" },
  { value: "overlays", label: "Overlays" },
  { value: "surfaces", label: "Surfaces" },
  { value: "accordion", label: "Accordion" },
] as const;

export default function ComponentsShowcase() {
  const [activePage, setActivePage] = useState<string>("buttons");
  const [sw1, setSw1] = useState(false);
  const [sw2, setSw2] = useState(true);
  const [radioValue, setRadioValue] = useState("option1");
  const [accordionOpen, setAccordionOpen] = useState<string[]>([]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Page Header ── */}
      <div className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-20 px-8 py-5">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-[20px] font-bold tracking-tight">Fluid Functionalism</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Component showcase — Base UI · Framer Motion · Tailwind v4
          </p>
        </div>
      </div>

      {/* ── Navigation ── */}
      <div className="border-b border-border/30 bg-background sticky top-[73px] z-10 px-8">
        <div className="max-w-4xl mx-auto">
          <Tabs value={activePage} onValueChange={setActivePage}>
            <TabsList className="bg-transparent border-none p-0 gap-0 h-10 rounded-none">
              {NAV_TABS.map((t) => (
                <TabsTab
                  key={t.value}
                  value={t.value}
                  className="h-10 px-4 rounded-none text-[13px] font-medium border-none bg-transparent"
                >
                  {t.label}
                </TabsTab>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-4xl mx-auto px-8 py-10 flex flex-col gap-14">

        {/* ═══ BUTTONS ═══ */}
        {activePage === "buttons" && (
          <>
            <Section
              title="Button — Variantes"
              description="primary · secondary · tertiary · ghost"
            >
              <Row label="Primary">
                <Button variant="primary" size="sm">Small</Button>
                <Button variant="primary" size="md">Medium</Button>
                <Button variant="primary" size="lg">Large</Button>
              </Row>
              <Row label="Secondary">
                <Button variant="secondary" size="sm">Small</Button>
                <Button variant="secondary" size="md">Medium</Button>
                <Button variant="secondary" size="lg">Large</Button>
              </Row>
              <Row label="Tertiary">
                <Button variant="tertiary" size="sm">Small</Button>
                <Button variant="tertiary" size="md">Medium</Button>
                <Button variant="tertiary" size="lg">Large</Button>
              </Row>
              <Row label="Ghost">
                <Button variant="ghost" size="sm">Small</Button>
                <Button variant="ghost" size="md">Medium</Button>
                <Button variant="ghost" size="lg">Large</Button>
              </Row>
            </Section>

            <Section
              title="Button — Íconos"
              description="icon-sm · icon · icon-lg"
            >
              <Row label="Primary icon">
                <Button variant="primary" size="icon-sm"><Plus /></Button>
                <Button variant="primary" size="icon"><Plus /></Button>
                <Button variant="primary" size="icon-lg"><Plus /></Button>
              </Row>
              <Row label="Secondary icon">
                <Button variant="secondary" size="icon-sm"><SettingsIcon /></Button>
                <Button variant="secondary" size="icon"><SettingsIcon /></Button>
                <Button variant="secondary" size="icon-lg"><SettingsIcon /></Button>
              </Row>
              <Row label="Ghost icon">
                <Button variant="ghost" size="icon-sm"><BellIcon /></Button>
                <Button variant="ghost" size="icon"><BellIcon /></Button>
                <Button variant="ghost" size="icon-lg"><BellIcon /></Button>
              </Row>
            </Section>

            <Section
              title="Button — Con ícono"
              description="Leading icon + texto · states: disabled"
            >
              <Row label="Leading icon">
                <Button variant="primary" size="md" leadingIcon={SearchIcon}>
                  Buscar
                </Button>
                <Button variant="secondary" size="md" leadingIcon={Plus}>
                  Nuevo
                </Button>
                <Button variant="tertiary" size="md" leadingIcon={DownloadIcon}>
                  Exportar
                </Button>
                <Button variant="ghost" size="md" leadingIcon={UploadIcon}>
                  Importar
                </Button>
              </Row>
              <Row label="Disabled">
                <Button variant="primary" size="md" disabled>Primary</Button>
                <Button variant="secondary" size="md" disabled>Secondary</Button>
                <Button variant="tertiary" size="md" disabled>Tertiary</Button>
                <Button variant="ghost" size="md" disabled>Ghost</Button>
              </Row>
            </Section>
          </>
        )}

        {/* ═══ TABS ═══ */}
        {activePage === "tabs" && (
          <>
            <Section
              title="Tabs — Default"
              description="Sliding underline indicator · spring animation · proximity hover"
            >
              <Tabs defaultValue="tab1">
                <TabsList>
                  <TabsTab value="tab1">Dashboard</TabsTab>
                  <TabsTab value="tab2">Inventario</TabsTab>
                  <TabsTab value="tab3">Reportes</TabsTab>
                  <TabsTab value="tab4">Configuración</TabsTab>
                </TabsList>
                <TabsPanel value="tab1" className="pt-6">
                  <Elevated offset={1} className="p-6 rounded-xl">
                    <p className="text-[13px] text-muted-foreground">
                      Panel Dashboard. El indicador se desliza suavemente entre tabs con spring physics.
                    </p>
                  </Elevated>
                </TabsPanel>
                <TabsPanel value="tab2" className="pt-6">
                  <Elevated offset={1} className="p-6 rounded-xl">
                    <p className="text-[13px] text-muted-foreground">Panel Inventario.</p>
                  </Elevated>
                </TabsPanel>
                <TabsPanel value="tab3" className="pt-6">
                  <Elevated offset={1} className="p-6 rounded-xl">
                    <p className="text-[13px] text-muted-foreground">Panel Reportes.</p>
                  </Elevated>
                </TabsPanel>
                <TabsPanel value="tab4" className="pt-6">
                  <Elevated offset={1} className="p-6 rounded-xl">
                    <p className="text-[13px] text-muted-foreground">Panel Configuración.</p>
                  </Elevated>
                </TabsPanel>
              </Tabs>
            </Section>

            <Section
              title="Tabs — Con íconos"
              description="Tabs con ícono + label"
            >
              <Tabs defaultValue="home">
                <TabsList>
                  <TabsTab value="home">
                    <HomeIcon className="w-4 h-4" />
                    Inicio
                  </TabsTab>
                  <TabsTab value="mail">
                    <MailIcon className="w-4 h-4" />
                    Mensajes
                  </TabsTab>
                  <TabsTab value="star">
                    <StarIcon className="w-4 h-4" />
                    Favoritos
                  </TabsTab>
                  <TabsTab value="user">
                    <UserIcon className="w-4 h-4" />
                    Perfil
                  </TabsTab>
                </TabsList>
                <TabsPanel value="home" className="pt-4">
                  <p className="text-[13px] text-muted-foreground">Inicio</p>
                </TabsPanel>
                <TabsPanel value="mail" className="pt-4">
                  <p className="text-[13px] text-muted-foreground">Mensajes</p>
                </TabsPanel>
                <TabsPanel value="star" className="pt-4">
                  <p className="text-[13px] text-muted-foreground">Favoritos</p>
                </TabsPanel>
                <TabsPanel value="user" className="pt-4">
                  <p className="text-[13px] text-muted-foreground">Perfil</p>
                </TabsPanel>
              </Tabs>
            </Section>
          </>
        )}

        {/* ═══ FORMS ═══ */}
        {activePage === "forms" && (
          <>
            <Section
              title="Switch"
              description="Spring thumb · moderate timing (0.16s, bounce 0.08)"
            >
              <Row label="Estados">
                <Switch
                  label="Notificaciones"
                  checked={sw1}
                  onToggle={() => setSw1(!sw1)}
                />
                <Switch
                  label="Modo activo"
                  checked={sw2}
                  onToggle={() => setSw2(!sw2)}
                />
                <Switch
                  label="Desactivado"
                  checked={false}
                  onToggle={() => {}}
                  disabled
                />
              </Row>
            </Section>

            <Section
              title="RadioGroup"
              description="Roving focus · proximity hover · spring selection background"
            >
              <RadioGroup value={radioValue} onValueChange={setRadioValue}>
                <RadioItem value="option1" label="Medicamentos" index={0} />
                <RadioItem value="option2" label="Perfumería" index={1} />
                <RadioItem value="option3" label="Accesorios" index={2} />
                <RadioItem value="option4" label="Varios" index={3} />
              </RadioGroup>
              <p className="text-[12px] text-muted-foreground mt-2">
                Seleccionado: <strong className="text-foreground">{radioValue}</strong>
              </p>
            </Section>
          </>
        )}

        {/* ═══ OVERLAYS ═══ */}
        {activePage === "overlays" && (
          <>
            <Section
              title="Tooltip"
              description="Fast spring entry (0.08s, bounce 0) · linear exit"
            >
              <TooltipProvider>
                <Row label="Posiciones">
                  <Tooltip>
                    <TooltipTrigger render={<Button variant="secondary" size="md">Top</Button>} />
                    <TooltipContent side="top">Tooltip arriba</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger render={<Button variant="secondary" size="md">Bottom</Button>} />
                    <TooltipContent side="bottom">Tooltip abajo</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger render={<Button variant="secondary" size="md">Left</Button>} />
                    <TooltipContent side="left">Tooltip izquierda</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger render={<Button variant="secondary" size="md">Right</Button>} />
                    <TooltipContent side="right">Tooltip derecha</TooltipContent>
                  </Tooltip>
                </Row>
                <Row label="En íconos">
                  <Tooltip>
                    <TooltipTrigger render={<Button variant="ghost" size="icon"><SettingsIcon /></Button>} />
                    <TooltipContent>Configuración</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger render={<Button variant="ghost" size="icon"><BellIcon /></Button>} />
                    <TooltipContent>Notificaciones</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger render={<Button variant="ghost" size="icon"><TrashIcon /></Button>} />
                    <TooltipContent className="text-destructive">Eliminar</TooltipContent>
                  </Tooltip>
                </Row>
              </TooltipProvider>
            </Section>

            <Section
              title="Dropdown Menu"
              description="Spring scale entrance · linear exit · keyboard navigable"
            >
              <Row label="Variantes">
                <DropdownMenu>
                  <DropdownTrigger
                    render={
                      <Button variant="secondary" size="md">
                        Opciones
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    }
                  />
                  <DropdownContent align="start">
                    <MenuItem
                      index={0}
                      icon={EditIcon}
                      label="Editar"
                    />
                    <MenuItem
                      index={1}
                      icon={DownloadIcon}
                      label="Descargar"
                    />
                    <MenuItem
                      index={2}
                      icon={UploadIcon}
                      label="Importar"
                    />
                    <DropdownSeparator />
                    <MenuItem
                      index={3}
                      icon={TrashIcon}
                      label="Eliminar"
                      className="text-destructive focus:text-destructive"
                    />
                  </DropdownContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownTrigger
                    render={
                      <Button variant="ghost" size="icon-lg">
                        <SettingsIcon />
                      </Button>
                    }
                  />
                  <DropdownContent align="end">
                    <MenuItem
                      index={0}
                      icon={UserIcon}
                      label="Mi perfil"
                    />
                    <MenuItem
                      index={1}
                      icon={BellIcon}
                      label="Notificaciones"
                    />
                    <DropdownSeparator />
                    <MenuItem
                      index={2}
                      label="Cerrar sesión"
                    />
                  </DropdownContent>
                </DropdownMenu>
              </Row>
            </Section>
          </>
        )}

        {/* ═══ SURFACES ═══ */}
        {activePage === "surfaces" && (
          <>
            <Section
              title="Elevation Ladder"
              description="8 niveles de superficie. Light: steps de brillo. Dark: white-opacity aditiva sobre #171717."
            >
              <ElevationDemo />
            </Section>

            <Section
              title="Superficies anidadas"
              description="Regla concéntrica: outer_radius = inner_radius + padding"
            >
              <SurfaceProvider value={1}>
                <Elevated offset={1} className="p-5 rounded-2xl w-full max-w-sm">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Surface 2
                  </p>
                  <Elevated offset={1} className="p-4 rounded-xl">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Surface 3
                    </p>
                    <Elevated offset={1} className="p-3 rounded-lg">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Surface 4 — Deepest
                      </p>
                    </Elevated>
                  </Elevated>
                </Elevated>
              </SurfaceProvider>
            </Section>

            <Section
              title="Shadow tokens"
              description="Cada nivel usa --shadow-N con capas aditivas"
            >
              <div className="flex flex-wrap gap-4">
                {([1, 2, 3, 4, 5, 6] as const).map((n) => (
                  <div
                    key={n}
                    className={cn(
                      "p-5 rounded-xl bg-background flex flex-col gap-1 items-center w-28"
                    )}
                    style={{ boxShadow: `var(--shadow-${n})` }}
                  >
                    <span className="text-[12px] font-semibold text-foreground">shadow-{n}</span>
                    <span className="text-[10px] text-muted-foreground/50">level {n}</span>
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}

        {/* ═══ ACCORDION ═══ */}
        {activePage === "accordion" && (
          <>
            <Section
              title="Accordion"
              description="Moderate spring (0.16s, bounce 0.08) · ghost-span font-weight transitions · openMultiple"
            >
              <div className="w-full max-w-2xl">
                <Accordion
                  type="multiple"
                  value={accordionOpen}
                  onValueChange={setAccordionOpen}
                >
                  <AccordionItem value="item1">
                    <AccordionTrigger>¿Qué es Fluid Functionalism?</AccordionTrigger>
                    <AccordionContent>
                      <p className="text-[13px] text-muted-foreground leading-relaxed">
                        Fluid Functionalism es un sistema de diseño basado en Base UI y Framer Motion. Usa físicas
                        de resorte para todas las transiciones de entrada y hover, y tweens lineales para cierres
                        y salidas.
                      </p>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item2">
                    <AccordionTrigger>¿Cuáles son los spring presets?</AccordionTrigger>
                    <AccordionContent>
                      <div className="text-[13px] text-muted-foreground space-y-2 leading-relaxed">
                        <p>
                          <strong className="text-foreground">fast</strong> — 0.08s, bounce 0.
                          Hover, focus rings, tooltips, sliders.
                        </p>
                        <p>
                          <strong className="text-foreground">moderate</strong> — 0.16s, bounce 0.08.
                          Dropdowns, switch thumbs, accordions.
                        </p>
                        <p>
                          <strong className="text-foreground">settle</strong> — 0.16s, bounce 0.
                          Mobile drawers, selection merges.
                        </p>
                        <p>
                          <strong className="text-foreground">slow</strong> — 0.24s, bounce 0.12.
                          Dialogs, side panels, stepped flows.
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item3">
                    <AccordionTrigger>Ghost-Span Pattern</AccordionTrigger>
                    <AccordionContent>
                      <p className="text-[13px] text-muted-foreground leading-relaxed">
                        Cuando el font-weight cambia dinámicamente entre normal y medium/bold, se usa un{" "}
                        <code className="text-[12px] font-mono bg-muted px-1 py-0.5 rounded">
                          span invisible
                        </code>{" "}
                        con el texto en bold para reservar el espacio y evitar layout reflow. El span visible
                        hace la transición suave sin mover el layout.
                      </p>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item4">
                    <AccordionTrigger>Concentric Radii Rule</AccordionTrigger>
                    <AccordionContent>
                      <p className="text-[13px] text-muted-foreground leading-relaxed">
                        Para mantener la coherencia visual en superficies anidadas, el radio del contenedor
                        exterior siempre debe ser <strong className="text-foreground">inner_radius + padding</strong>.
                        Por ejemplo: contenido con <code className="text-[12px] font-mono bg-muted px-1 py-0.5 rounded">rounded-lg</code>{" "}
                        dentro de un padre con <code className="text-[12px] font-mono bg-muted px-1 py-0.5 rounded">p-3 rounded-xl</code>.
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </Section>
          </>
        )}

        {/* ── Footer ── */}
        <div className="pt-8 border-t border-border/30 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground/40">
            Fluid Functionalism · Base UI · Framer Motion
          </span>
          <span className="text-[11px] text-muted-foreground/40 tabular-nums">
            {new Date().toLocaleDateString("es-AR")}
          </span>
        </div>
      </div>
    </div>
  );
}
