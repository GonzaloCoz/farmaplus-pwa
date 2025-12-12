import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Phone, MapPin, LogOut, Settings, Shield } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";

export default function Profile() {
    const navigate = useNavigate();
    const { user, logout } = useUser();

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    if (!user) {
        return <div>Cargando perfil...</div>;
    }

    return (
        <PageLayout>

            <div className="space-y-8 pb-24">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                    <Avatar className="w-24 h-24 sm:w-32 sm:h-32 border-4 border-background shadow-xl">
                        <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
                        <AvatarFallback>{user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="text-center sm:text-left space-y-2">
                        <h1 className="text-3xl font-bold">{user.name}</h1>
                        <p className="text-muted-foreground flex items-center justify-center sm:justify-start gap-2">
                            <Shield className="w-4 h-4" />
                            Administrador de Sucursal
                        </p>
                        <div className="flex gap-2 justify-center sm:justify-start">
                            <Button variant="outline" size="sm" onClick={() => navigate("/settings")}>
                                <Settings className="w-4 h-4 mr-2" />
                                Configuración
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Información Personal</CardTitle>
                            <CardDescription>Detalles de tu cuenta y contacto.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Nombre Completo</Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input defaultValue={user.name} className="pl-9" readOnly />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Correo Electrónico</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input defaultValue={`encargado${user.branchName}@farmaplus.com.ar`} className="pl-9" readOnly />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Teléfono</Label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input defaultValue="+54 11 1234-5678" className="pl-9" readOnly />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Sucursal Asignada</CardTitle>
                            <CardDescription>Información de tu lugar de trabajo.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Sucursal</Label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input defaultValue={user.branchName} className="pl-9" readOnly />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Rol</Label>
                                <Input defaultValue="Gerente de Inventario" readOnly />
                            </div>
                            <Separator className="my-4" />
                            <Button variant="destructive" className="w-full" onClick={handleLogout}>
                                <LogOut className="w-4 h-4 mr-2" />
                                Cerrar Sesión
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </PageLayout>
    );
}
