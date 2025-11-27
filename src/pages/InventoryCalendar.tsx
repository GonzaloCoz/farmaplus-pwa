import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CalendarDays, Clock, Users } from "lucide-react";

const inventoryData = [
  {
    branch: "Sucursal Centro",
    perfumery: {
      date: "2024-07-22T21:00:00",
      hours: 5,
      staff: 4,
    },
    pharmacy: {
      date: "2024-08-05T21:00:00",
      hours: 6,
      staff: 5,
    },
  },
  {
    branch: "Sucursal Norte",
    perfumery: {
      date: "2024-07-29T21:00:00",
      hours: 4.5,
      staff: 3,
    },
    pharmacy: {
      date: "2024-07-24T21:00:00",
      hours: 7,
      staff: 6,
    },
  },
  {
    branch: "Sucursal Sur",
    perfumery: {
      date: "2024-07-26T21:00:00",
      hours: 5.5,
      staff: 4,
    },
    pharmacy: {
      date: "2024-08-12T21:00:00",
      hours: 6.5,
      staff: 5,
    },
  },
];

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("es-ES", {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }) + ' hs';
};

export default function InventoryCalendar() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Calendario de Inventarios Nocturnos
        </h1>
        <p className="text-muted-foreground">
          Planificación mensual de los próximos inventarios por sucursal y sector.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Julio / Agosto 2024</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Sucursales</TableHead>
                <TableHead>Perfumería</TableHead>
                <TableHead>Farmacia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventoryData.map((item) => (
                <TableRow key={item.branch}>
                  <TableCell className="font-semibold">{item.branch}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-muted-foreground" /> <span>{formatDate(item.perfumery.date)}</span></div>
                      <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /> <span>Duración: {item.perfumery.hours} hs</span></div>
                      <div className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /> <span>Personal: {item.perfumery.staff}</span></div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-muted-foreground" /> <span>{formatDate(item.pharmacy.date)}</span></div>
                      <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /> <span>Duración: {item.pharmacy.hours} hs</span></div>
                      <div className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /> <span>Personal: {item.pharmacy.staff}</span></div>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}