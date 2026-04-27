import { NotificationsMenu } from "@/components/HeaderMenus";
import { TrainingCenterButton } from "./TrainingCenterButton";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import Logo from "@/assets/logo.svg";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function TopAppBar() {
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = (e: Event) => {
            const target = e.target as HTMLElement;
            // Detect scroll in any child of main-content (individual windows)
            if (target && (target.id === "main-content" || target.closest("#main-content"))) {
                setIsScrolled(target.scrollTop > 10);
            }
        };

        window.addEventListener("scroll", handleScroll, true);
        return () => window.removeEventListener("scroll", handleScroll, true);
    }, []);

    return (
        <header
            style={{ 
                height: 'var(--total-header-height)',
                paddingTop: 'var(--safe-top)'
            }}
            className={cn(
                "fixed top-0 left-0 right-0 z-40 w-full transition-all duration-300 lg:hidden top-app-bar",
                isScrolled
                    ? "bg-background/80  shadow-sm border-b supports-[backdrop-filter]:bg-background/60"
                    : "bg-transparent border-b-0"
            )}
        >
            <div className="flex items-center justify-between px-4" style={{ height: 'var(--header-height)' }}>
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

