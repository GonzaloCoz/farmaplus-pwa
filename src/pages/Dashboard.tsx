import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { CounterAnimation } from "@/components/CounterAnimation";
import { AnimatedProgressBar } from "@/components/AnimatedProgressBar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  DollarSign,
  Package,
  TrendingDown,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Users,
  CreditCard,
  AlertCircle,
  CalendarClock,
  Search,
  Mail,
  ArrowUpDown,
  LucideIcon
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import CustomCalendar from "@/components/CustomCalendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/use-media-query";

const upcomingInventories = [
  {
    branch: "Belgrano IV",
    sector: "Farmacia",
    date: "Miércoles, 19 de Noviembre",
    iso: "2025-11-19",
  },
  {
    branch: "Recoleta",
    sector: "Farmacia",
    date: "Viernes, 21 de Noviembre",
    iso: "2025-11-21",
  },
  {
    branch: "Villa Urquiza II",
    sector: "Perfumería",
    date: "Miércoles, 26 de Julio",
    iso: "2026-07-26",
  },
];

interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: LucideIcon;
}

function MetricCard({ title, value, change, changeType = "neutral", icon: Icon }: MetricCardProps) {
  const changeColors = {
    positive: "text-success",
    negative: "text-destructive",
    neutral: "text-muted-foreground",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change && <p className={`text-xs ${changeColors[changeType]}`}>{change}</p>}
      </CardContent>
    </Card>
  );
}

type Branch = {
  name: string;
  address: string;
  zonal: string;
  email: string;
};

const branches = [
  { name: "Barracas", address: "Av Montes de Oca 895, CABA.", zonal: "Christian Mc Garva", email: "encargadoBarracas@farmaplus.com.ar" },
  { name: "Beccar", address: "Av Sucre 2143, Beccar", zonal: "Andres Zanovello", email: "encargadoBeccar@farmaplus.com.ar" },
  { name: "Belgrano", address: "Av Cabildo 1566, CABA", zonal: "Javier Paredes", email: "encargadoBelgrano@farmaplus.com.ar" },
  { name: "Belgrano II", address: "Juramento 2741, CABA", zonal: "Javier Paredes", email: "encargadoBelgranoII@farmaplus.com.ar" },
  { name: "Belgrano III", address: "Av. Cabildo 2540, CABA", zonal: "Christian Mc Garva", email: "encargadoBelgranoIII@farmaplus.com.ar" },
  { name: "Belgrano IV", address: "Av. Cabildo 2178, CABA", zonal: "Jorge Arredondo", email: "encargadoBelgranoIV@farmaplus.com.ar" },
  { name: "Belgrano V", address: "Echeverrí­a 3187, CABA", zonal: "Javier Paredes", email: "encargadoBelgranoV@farmaplus.com.ar" },
  { name: "Belgrano VI", address: "Av. Libertador 6283, CABA", zonal: "Javier Paredes", email: "encargadoBelgranoVI@farmaplus.com.ar" },
  { name: "Belgrano VII", address: "Av.Cabildo 2171, CABA", zonal: "Diego Ruiz", email: "encargadoBelgranoVII@farmaplus.com.ar" },
  { name: "Belgrano VIII", address: "Av Congreso 2486, CABA", zonal: "Diego Ruiz", email: "encargadoBelgranoVIII@farmaplus.com.ar" },
  { name: "Berazategui", address: "Av. 14 Pres. Juan Domingo Perón 4998, Berazategui", zonal: "Diego Ruiz", email: "encargadoBerazategui@farmaplus.com.ar" },
  { name: "Berazategui II", address: "Lisandro de la Torre 1596, Berazategui", zonal: "Christian Mc Garva", email: "encargadoBerazateguiII@farmaplus.com.ar" },
  { name: "Caballito", address: "Av Rivadavia 5014, CABA", zonal: "Romina Agüero", email: "encargadoCaballito@farmaplus.com.ar" },
  { name: "Caballito II", address: "Av José Marí­a Moreno 99, CABA", zonal: "Christian Mc Garva", email: "encargadoCaballitoII@farmaplus.com.ar" },
  { name: "Caballito III", address: "Av Rivadavia 4718, CABA", zonal: "Jorge Arredondo", email: "encargadoCaballitoIII@farmaplus.com.ar" },
  { name: "Caballito IV", address: "Av. Rivadavia 4502", zonal: "Romina Agüero", email: "encargadoCaballitoIV@farmaplus.com.ar" },
  { name: "Chacarita", address: "Federico Lacroze 3642", zonal: "Christian Mc Garva", email: "encargadoChacarita@farmaplus.com.ar" },
  { name: "Devoto", address: "Av Francisco Beiró 5402, CABA", zonal: "Andres Zanovello", email: "encargadoDevoto@farmaplus.com.ar" },
  { name: "Devoto II", address: "Nueva York 4074, C1419HDR Cdad", zonal: "Andres Zanovello", email: "encargadoDevotoII@farmaplus.com.ar" },
  { name: "Flores", address: "Av Rivadavia 6854, CABA", zonal: "Romina Agüero", email: "encargadoFlores@farmaplus.com.ar" },
  { name: "Gonzalez Catan", address: "LTO, Av. José Equiza 4171, B1759 González Catán", zonal: "Esteban J Mendoza", email: "encargadoGCatan@farmaplus.com.ar" },
  { name: "Gonzalez Catan II", address: "Dr, Dr. Enrique Simón Pérez 4802, B1759LXL González Catán", zonal: "Esteban J Mendoza", email: "encargadoGCatanII@farmaplus.com.ar" },
  { name: "Gonzalez Catan III", address: "Icalma 7648, B1759 González Catán", zonal: "Esteban J Mendoza", email: "encargadoGCatanIII@farmaplus.com.ar" },
  { name: "Las Cañitas", address: "Maure 1691, CABA", zonal: "Christian Mc Garva", email: "encargadoLasCanitas@farmaplus.com.ar" },
  { name: "Mercedes", address: "C. 27 548, Mercedes, Provincia de Buenos Aires", zonal: "Esteban J Mendoza", email: "encargadoMercedes@farmaplus.com.ar" },
  { name: "Microcentro", address: "25 de Mayo 222, CABA", zonal: "Diego Ruiz", email: "encargadoMicrocentro@farmaplus.com.ar" },
  { name: "Microcentro II", address: "Av de Mayo 675, CABA", zonal: "Diego Ruiz", email: "encargadoMicrocentroII@farmaplus.com.ar" },
  { name: "Morón", address: "República Oriental del Uruguay 265, B1708 Morón", zonal: "Esteban J Mendoza", email: "encargadoMoron@farmaplus.com.ar" },
  { name: "Nuñez", address: "Av Cabildo 3834, CABA", zonal: "Jorge Arredondo", email: "encargadoNunez@farmaplus.com.ar" },
  { name: "Padua", address: "Av. Pres. Juan Domingo Perón 23870, B1718GKQ San Antonio de Padua", zonal: "Esteban J Mendoza", email: "encargadoPadua@farmaplus.com.ar" },
  { name: "Palermo", address: "San Martí­n de Tours 2976, CABA", zonal: "Jorge Arredondo", email: "encargadoPalermo@farmaplus.com.ar" },
  { name: "Palermo II", address: "Guemes 3302", zonal: "Javier Paredes", email: "encargadoPalermoII@farmaplus.com.ar" },
  { name: "Palermo III", address: "Av. Sta. Fe 3350", zonal: "Jorge Arredondo", email: "encargadoPalermoIII@farmaplus.com.ar" },
  { name: "Parque Centenario", address: "Hidalgo 805, CABA", zonal: "Javier Paredes", email: "encargadoParqueCentenario@farmaplus.com.ar" },
  { name: "Parque Patricios", address: "Av. Caseros 2827, CABA", zonal: "Javier Paredes", email: "encargadoParquePatricios@farmaplus.com.ar" },
  { name: "Pilar", address: "Schubert 1950 Pilar, Buenos Aires Argentina", zonal: "Andres Zanovello", email: "encargadoPilar@farmaplus.com.ar" },
  { name: "Pompeya", address: "Av Sáenz 1187, CABA", zonal: "Christian Mc Garva", email: "encargadoPompeya@farmaplus.com.ar" },
  { name: "Quilmes", address: "Alsina 127, Quilmes", zonal: "Diego Ruiz", email: "encargadoQuilmes@farmaplus.com.ar" },
  { name: "Ramos Mejia", address: "Dr. Gabriel Ardoino 640, B1704 Ramos Mejía", zonal: "Esteban J Mendoza", email: "encargadoRamosMejia@farmaplus.com.ar" },
  { name: "Ramos Mejia II", address: "Av. Rivadavia 13236, B1704 Ramos Mejía", zonal: "Esteban J Mendoza", email: "encargadoRamosMejiaII@farmaplus.com.ar" },
  { name: "Ramos Mejia III", address: "Av. de Mayo 1212, B1704 Ramos Mejía", zonal: "Esteban J Mendoza", email: "encargadoRamosMejiaIII@farmaplus.com.ar" },
  { name: "Recoleta", address: "José Andrés Pacheco de Melo 2402, CABA", zonal: "Jorge Arredondo", email: "encargadoRecoleta@farmaplus.com.ar" },
  { name: "Recoleta II", address: "Av Gral. Las Heras 2273, CABA", zonal: "Jorge Arredondo", email: "encargadoRecoletaII@farmaplus.com.ar" },
  { name: "Recoleta III", address: "Av Pueyrredón 1428 , CABA", zonal: "Jorge Arredondo", email: "encargadoRecoletaIII@farmaplus.com.ar" },
  { name: "Recoleta IV", address: "Av. Pueyrredón 1673, CABA", zonal: "Jorge Arredondo", email: "encargadoRecoletaIV@farmaplus.com.ar" },
  { name: "Recoleta V", address: "Av Córdoba 2501, CABA", zonal: "Romina Agüero", email: "encargadoRecoletaV@farmaplus.com.ar" },
  { name: "Retiro", address: "Reconquista 1015, CABA", zonal: "Diego Ruiz", email: "encargadoRetiro@farmaplus.com.ar" },
  { name: "Retiro II", address: "Av Córdoba 533 , CABA", zonal: "Diego Ruiz", email: "encargadoRetiroII@farmaplus.com.ar" },
  { name: "Saladillo", address: "Av. Rivadavia 3158", zonal: "Esteban J Mendoza", email: "encargadoSaladillo@farmaplus.com.ar" },
  { name: "San Isidro", address: "Av Diego Carman 621, Martí­nez", zonal: "Andres Zanovello", email: "encargadoSanIsidro@farmaplus.com.ar" },
  { name: "San Isidro II", address: "Av Centenario 700, San Isidro", zonal: "Andres Zanovello", email: "encargadoSanIsidroII@farmaplus.com.ar" },
  { name: "San Miguel", address: "Av. Dr. Ricardo Balbín 1346, San Miguel.", zonal: "Andres Zanovello", email: "encargadoSanMiguel@farmaplus.com.ar" },
  { name: "Tribunales", address: "Uruguay 479, CABA", zonal: "Diego Ruiz", email: "encargadoTribunales@farmaplus.com.ar" },
  { name: "Villa Ballester", address: "Alvear 2640, Villa Ballester.", zonal: "Andres Zanovello", email: "encargadoVillaBallester@farmaplus.com.ar" },
  { name: "Villa Ballester II", address: "Almirante Brown 3099, Villa Ballester.", zonal: "Andres Zanovello", email: "encargadoVillaBallesterII@farmaplus.com.ar" },
  { name: "Villa Crespo", address: "Av Corrientes 5270, CABA.", zonal: "Romina Agüero", email: "encargadoVillaCrespo@farmaplus.com.ar" },
  { name: "Villa del Parque", address: "Nazca 2301, CABA", zonal: "Christian Mc Garva", email: "encargadoVilladelParque@farmaplus.com.ar" },
  { name: "Villa del Parque II", address: "Cuenca 3190, CABA", zonal: "Andres Zanovello", email: "encargadoVilladelParqueII@farmaplus.com.ar" },
  { name: "Villa Luro", address: "Lope de Vega 1397", zonal: "Christian Mc Garva", email: "encargadoVillaLuro@farmaplus.com.ar" },
  { name: "Villa Urquiza", address: "Av. Triunvirato 4602, CABA", zonal: "Romina Agüero", email: "encargadoVillaUrquiza@farmaplus.com.ar" },
  { name: "Villa Urquiza II", address: "Av. Triunvirato 3749, CABA", zonal: "Romina Agüero", email: "encargadoVillaUrquizaII@farmaplus.com.ar" },
  { name: "Villa Urquiza III", address: "Av. Triunvirato 4499, CABA", zonal: "Romina Agüero", email: "encargadoVillaUrquizaIII@farmaplus.com.ar" },
];

const INITIAL_BRANCHES_TO_SHOW = 5;



const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

function CalendarContent({
  events,
  selectedDate,
  setSelectedDate,
  showAddForm,
  setShowAddForm,
  newTitle,
  setNewTitle,
  newBranch,
  setNewBranch,
  newSector,
  setNewSector,
  newDate,
  setNewDate,
  handleAddEvent,
  setEvents,
  eventsForDay,
  eventsForMonth,
  isMobile = false
}: any) {
  return (
    <div className={`flex ${isMobile ? 'flex-col' : 'gap-2'} mt-4`}>
      <div className={isMobile ? 'w-full mb-4' : 'w-2/5'}>
        <CustomCalendar
          events={events}
          selected={selectedDate}
          onSelect={(d) => {
            if (d) setSelectedDate(d as Date);
          }}
        />
      </div>
      <div className={isMobile ? 'w-full' : 'w-3/5'}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium">Eventos</h3>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setShowAddForm((s: boolean) => !s)}>Agregar Evento</Button>
          </div>
        </div>

        {selectedDate ? (
          <div className="mb-4 text-sm text-muted-foreground">Mostrando: {selectedDate.toLocaleDateString('es-ES')}</div>
        ) : (
          <div className="mb-4 text-sm text-muted-foreground">Selecciona un día o ver todo el mes</div>
        )}

        <div className="space-y-3 max-h-[420px] overflow-auto">
          {(selectedDate ? eventsForDay(selectedDate) : eventsForMonth(selectedDate || new Date())).map((ev: any) => (
            <div key={ev.id} className="p-3 bg-muted/50 rounded-md">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{ev.title}</div>
                  <div className="text-xs text-muted-foreground">{ev.branch} · {ev.sector}</div>
                  <div className="text-xs text-muted-foreground mt-1">{new Date(ev.date).toLocaleDateString('es-ES')}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEvents((prev: any[]) => prev.filter(p => p.id !== ev.id))}>Eliminar</Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {showAddForm && (
          <div className="mt-4 p-3 bg-background border rounded-md">
            <div className="space-y-2">
              <input className="w-full p-2 border rounded" placeholder="Título" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              <input className="w-full p-2 border rounded" placeholder="Sucursal" value={newBranch} onChange={(e) => setNewBranch(e.target.value)} />
              <input className="w-full p-2 border rounded" placeholder="Sector" value={newSector} onChange={(e) => setNewSector(e.target.value)} />
              <input type="date" className="w-full p-2 border rounded" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              <div className="flex justify-end">
                <Button size="sm" onClick={handleAddEvent}>Guardar</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAllBranches, setShowAllBranches] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Branch; direction: 'ascending' | 'descending' }>({ key: 'name', direction: 'ascending' });
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const filteredBranches = branches.filter(
    (branch) =>
      branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      branch.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      branch.zonal.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (branch.email && branch.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const sortedBranches = useMemo(() => {
    let sortableItems = [...filteredBranches];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredBranches, sortConfig]);

  const requestSort = (key: keyof Branch) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key: keyof Branch) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-0 group-hover:opacity-50" />;
    return sortConfig.direction === 'ascending' ? <ArrowUpDown className="ml-2 h-4 w-4" /> : <ArrowUpDown className="ml-2 h-4 w-4" />;
  };

  const branchesToShow = showAllBranches
    ? sortedBranches
    : sortedBranches.slice(0, INITIAL_BRANCHES_TO_SHOW);

  // Eventos / Inventarios (persistidos en localStorage)
  type EventItem = { id: string; title: string; branch: string; sector: string; date: string }; // date ISO
  const [events, setEvents] = useState<EventItem[]>(() => {
    try {
      const raw = localStorage.getItem("inventory-events");
      if (raw) return JSON.parse(raw);
    } catch (e) {
      // ignore
    }
    // Inicializar desde upcomingInventories
    return upcomingInventories.map((u, i) => ({
      id: `evt-${i}`,
      title: `${u.branch} - ${u.sector}`,
      branch: u.branch,
      sector: u.sector,
      date: u.iso,
    }));
  });

  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBranch, setNewBranch] = useState("");
  const [newSector, setNewSector] = useState("");
  const [newDate, setNewDate] = useState<string>(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    localStorage.setItem("inventory-events", JSON.stringify(events));
  }, [events]);

  const eventsForMonth = (date: Date) => {
    const month = date.getMonth();
    const year = date.getFullYear();
    return events.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });
  };

  const eventsForDay = (date: Date) => {
    const iso = date.toISOString().slice(0, 10);
    return events.filter(e => e.date === iso);
  };

  const openCalendarForIso = (iso?: string) => {
    const d = iso ? new Date(iso) : new Date();
    setSelectedDate(d);
    setShowCalendar(true);
  };

  const handleAddEvent = () => {
    const id = `evt-${Date.now()}`;
    const item: EventItem = { id, title: newTitle || `${newBranch} - ${newSector}`, branch: newBranch, sector: newSector, date: newDate };
    setEvents(prev => [...prev, item]);
    setShowAddForm(false);
    setNewTitle("");
    setNewBranch("");
    setNewSector("");
    setNewDate(newDate);
  };

  return (
    <motion.div
      className="p-6 space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={itemVariants}>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Buenos días, Gonzalo 👋
        </h1>
        <p className="text-muted-foreground">
          Aca está el resumen de tus inventarios de hoy
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div variants={itemVariants} layoutId="card-total" whileHover={{ scale: 1.02, y: -4 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.2 }}>
          <Card className="cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Total Inventario</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <CounterAnimation value={120000} prefix="$" />
              </div>
              <p className="text-xs text-success">+12% del mes anterior</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants} layoutId="card-active" whileHover={{ scale: 1.02, y: -4 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.2 }}>
          <Card className="cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Productos Activos</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <CounterAnimation value={352} />
              </div>
              <p className="text-xs text-muted-foreground">En stock</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants} layoutId="card-missing" whileHover={{ scale: 1.02, y: -4 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.2 }}>
          <Card className="cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Productos con Faltantes</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <CounterAnimation value={24} />
              </div>
              <p className="text-xs text-destructive">+5% más que el mes anterior</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants} layoutId="card-surplus" whileHover={{ scale: 1.02, y: -4 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.2 }}>
          <Card className="cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Productos con Sobrantes</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <CounterAnimation value={18} />
              </div>
              <p className="text-xs text-success">+2% más que el mes anterior</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>



      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="h-full">
          <Card className="p-6 h-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-foreground">Resumen de Inventario</h2>
              <button className="text-sm text-muted-foreground hover:text-foreground">
                Ver detalles
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Productos en Stock</span>
                  <span className="text-sm font-medium">85%</span>
                </div>
                <AnimatedProgressBar value={85} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Productos con Bajo Stock</span>
                  <span className="text-sm font-medium text-warning">12%</span>
                </div>
                <AnimatedProgressBar value={12} variant="warning" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Productos Agotados</span>
                  <span className="text-sm font-medium text-destructive">3%</span>
                </div>
                <AnimatedProgressBar value={3} variant="destructive" />
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants} className="h-full">
          <Card className="p-6 h-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-foreground">Alertas de Inventario</h2>
              <span className="px-3 py-1 bg-warning/10 text-warning text-xs font-medium rounded-full">
                3 Activas
              </span>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <AlertCircle className="w-5 h-5 text-warning mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Stock bajo en Sucursal Palermo II</p>
                  <p className="text-xs text-muted-foreground mt-1">15 productos necesitan reabastecimiento</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <AlertCircle className="w-5 h-5 text-warning mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Inventario cíclico pendiente</p>
                  <p className="text-xs text-muted-foreground mt-1">Sucursal Microcentro - Vence en 2 días</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Diferencia significativa detectada</p>
                  <p className="text-xs text-muted-foreground mt-1">Sucursal Belgrano III - Revisar urgente</p>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants} className="h-full">
          <Card className="p-6 h-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-foreground">Próximos Inventarios</h2>
              <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                {upcomingInventories.length} esta semana
              </span>
            </div>
            <div className="space-y-4">
              {upcomingInventories.map((inv, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <CalendarClock className="w-5 h-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{inv.branch} - {inv.sector}</p>
                    <button onClick={() => openCalendarForIso(inv.iso)} className="text-xs text-muted-foreground mt-1 hover:underline">
                      {inv.date}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>

      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle>Sucursales</CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar sucursal..."
                className="pl-8 sm:w-[300px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">
                    <Button variant="ghost" onClick={() => requestSort('name')} className="group -ml-4">
                      Sucursal {getSortIndicator('name')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => requestSort('zonal')} className="group -ml-4">
                      Zonal {getSortIndicator('zonal')}
                    </Button>
                  </TableHead>
                  <TableHead className="flex-1">
                    <Button variant="ghost" onClick={() => requestSort('address')} className="group -ml-4">
                      Dirección {getSortIndicator('address')}
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">Contacto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branchesToShow.map((branch) => (
                  <TableRow key={branch.name}>
                    <TableCell className="font-medium">{branch.name}</TableCell>
                    <TableCell>{branch.zonal}</TableCell>
                    <TableCell>{branch.address}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="icon">
                        <a href={`mailto:${branch.email}`}>
                          <Mail className="h-4 w-4" />
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {sortedBranches.length > INITIAL_BRANCHES_TO_SHOW && !showAllBranches && (
              <div className="pt-4 text-center">
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setShowAllBranches(true)}
                >
                  Mostrar más ({sortedBranches.length - INITIAL_BRANCHES_TO_SHOW} restantes)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
      {/* Modal calendario + eventos */}
      {/* Modal calendario + eventos (Responsive) */}
      {isDesktop ? (
        <Dialog open={showCalendar} onOpenChange={setShowCalendar}>
          <DialogContent className="w-[1800px] max-w-[90vw]">
            <DialogHeader>
              <DialogTitle>Próximos inventarios</DialogTitle>
            </DialogHeader>
            <CalendarContent
              events={events}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              showAddForm={showAddForm}
              setShowAddForm={setShowAddForm}
              newTitle={newTitle}
              setNewTitle={setNewTitle}
              newBranch={newBranch}
              setNewBranch={setNewBranch}
              newSector={newSector}
              setNewSector={setNewSector}
              newDate={newDate}
              setNewDate={setNewDate}
              handleAddEvent={handleAddEvent}
              setEvents={setEvents}
              eventsForDay={eventsForDay}
              eventsForMonth={eventsForMonth}
            />
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={showCalendar} onOpenChange={setShowCalendar}>
          <DrawerContent>
            <DrawerHeader className="text-left">
              <DrawerTitle>Próximos inventarios</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4">
              <CalendarContent
                events={events}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                showAddForm={showAddForm}
                setShowAddForm={setShowAddForm}
                newTitle={newTitle}
                setNewTitle={setNewTitle}
                newBranch={newBranch}
                setNewBranch={setNewBranch}
                newSector={newSector}
                setNewSector={setNewSector}
                newDate={newDate}
                setNewDate={setNewDate}
                handleAddEvent={handleAddEvent}
                setEvents={setEvents}
                eventsForDay={eventsForDay}
                eventsForMonth={eventsForMonth}
                isMobile
              />
            </div>
          </DrawerContent>
        </Drawer>
      )}

    </motion.div>
  );
}
