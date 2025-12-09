import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Settings, LogOut, User } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

interface UserProfileSheetProps {
    trigger: React.ReactNode;
}

export function UserProfileSheet({ trigger }: UserProfileSheetProps) {
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);

    const handleNavigation = (path: string) => {
        setOpen(false);
        navigate(path);
    };

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
                {trigger}
            </DrawerTrigger>
            <DrawerContent>
                <div className="mx-auto w-full max-w-sm">
                    <DrawerHeader className="flex flex-col items-center gap-4 pt-6 pb-6">
                        <div className="relative">
                            <Avatar className="h-20 w-20 border-4 border-background shadow-xl">
                                <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
                                <AvatarFallback>GC</AvatarFallback>
                            </Avatar>
                            <div className="absolute bottom-0 right-0 rounded-full bg-background p-1 shadow-sm">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                                    F
                                </div>
                            </div>
                        </div>
                        <div className="text-center space-y-1">
                            <DrawerTitle className="text-xl font-semibold">Gonzalo Coz</DrawerTitle>
                            <p className="text-sm text-muted-foreground">gonzzalocoz@gmail.com</p>
                        </div>
                        <Button variant="outline" className="rounded-full px-6 h-8 text-xs" onClick={() => handleNavigation("/profile")}>
                            Administrar tu Cuenta de Farmaplus
                        </Button>
                    </DrawerHeader>

                    <div className="p-4 space-y-2 pb-8">
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <Button
                                variant="outline"
                                className="h-20 flex flex-col gap-2 rounded-xl border-muted-foreground/20 hover:bg-muted/50 hover:border-primary/50 transition-all"
                                onClick={toggleTheme}
                            >
                                {theme === 'dark' ? <Moon className="h-6 w-6" /> : <Sun className="h-6 w-6" />}
                                <span className="text-xs font-medium">
                                    Tema {theme === 'dark' ? 'Oscuro' : 'Claro'}
                                </span>
                            </Button>
                            <Button
                                variant="outline"
                                className="h-20 flex flex-col gap-2 rounded-xl border-muted-foreground/20 hover:bg-muted/50 hover:border-primary/50 transition-all"
                                onClick={() => handleNavigation("/settings")}
                            >
                                <Settings className="h-6 w-6" />
                                <span className="text-xs font-medium">Configuración</span>
                            </Button>
                        </div>

                        <div className="space-y-1">
                            <Button variant="ghost" className="w-full justify-start gap-3 h-12 rounded-xl" onClick={() => handleNavigation("/profile")}>
                                <User className="h-5 w-5 text-muted-foreground" />
                                <span>Tu Perfil</span>
                            </Button>
                            <Button variant="ghost" className="w-full justify-start gap-3 h-12 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10">
                                <LogOut className="h-5 w-5" />
                                <span>Cerrar Sesión</span>
                            </Button>
                        </div>

                        <div className="pt-4 text-center">
                            <p className="text-[10px] text-muted-foreground">
                                Política de Privacidad • Términos de Servicio
                            </p>
                        </div>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    );
}
