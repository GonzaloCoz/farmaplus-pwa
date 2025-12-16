import { NotificationsMenu } from "@/components/HeaderMenus";
import { UserProfileSheet } from "@/components/UserProfileSheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Logo from "@/assets/logo.svg";
import DefaultAvatar from "@/assets/default-avatar.svg";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

export function TopAppBar() {
    const [isScrolled, setIsScrolled] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const mainContent = document.getElementById("main-content");
        if (!mainContent) return;

        const handleScroll = () => {
            setIsScrolled(mainContent.scrollTop > 10);
        };

        mainContent.addEventListener("scroll", handleScroll);
        return () => mainContent.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <header
            className={cn(
                "absolute top-0 left-0 right-0 z-40 w-full transition-all duration-300 lg:hidden",
                isScrolled
                    ? "bg-background/80 backdrop-blur-md shadow-sm border-b supports-[backdrop-filter]:bg-background/60"
                    : "bg-transparent border-b-0"
            )}
        >
            <div className="flex h-16 items-center justify-between px-8">
                {/* Logo Left */}
                <div className="flex items-center">
                    <img src={Logo} alt="Farmaplus" className="h-7 w-auto" />
                </div>

                {/* Actions Right */}
                <div className="flex items-center gap-2">
                    <NotificationsMenu />

                    <UserProfileSheet
                        trigger={
                            <button
                                className="flex items-center justify-center h-12 w-12 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                            >
                                <div className="p-0.5 rounded-full bg-gradient-to-tr from-blue-500 via-red-500 to-yellow-500">
                                    <Avatar className="h-8 w-8 border-2 border-background bg-card">
                                        <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                                            <img src={DefaultAvatar} alt="User" className="h-5 w-5 opacity-70" />
                                        </div>
                                    </Avatar>
                                </div>
                            </button>
                        }
                    />
                </div>
            </div>
        </header>
    );
}
