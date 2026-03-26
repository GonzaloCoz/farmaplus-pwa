import { NotificationsMenu } from "@/components/HeaderMenus";
import { TrainingCenterButton } from "./TrainingCenterButton";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import Logo from "@/assets/logo.svg";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function TopAppBar() {
    const [isScrolled, setIsScrolled] = useState(false);

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
            <div className="flex h-16 items-center justify-between px-4">
                {/* Logo Left */}
                <div className="flex items-center">
                    <img src={Logo} alt="Farmaplus" className="h-7 w-auto" />
                </div>

                {/* Actions Right */}
                <div className="flex items-center gap-2">
                    <TrainingCenterButton />
                    <NotificationsMenu />
                    <ProfileDropdown />
                </div>
            </div>
        </header>
    );
}
