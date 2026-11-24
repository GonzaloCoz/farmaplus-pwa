
export function SplashScreen() {
    return (
        <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-50">
            <div className="relative">
                {/* Logo Container with Pulse Effect */}
                <div className="w-20 h-20 bg-primary/20 rounded-full animate-ping absolute inset-0" />
                <div className="w-20 h-20 bg-background rounded-full relative flex items-center justify-center border-2 border-primary shadow-sm z-10">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-10 h-10 text-primary"
                    >
                        <path d="M12 2v4" />
                        <path d="m16.2 7.8 2.9-2.9" />
                        <path d="M18 12h4" />
                        <path d="m16.2 16.2 2.9 2.9" />
                        <path d="M12 18v4" />
                        <path d="m4.9 19.1 2.9-2.9" />
                        <path d="M2 12h4" />
                        <path d="m4.9 4.9 2.9 2.9" />
                    </svg>
                </div>
            </div>

            <div className="mt-8 flex flex-col items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Farmaplus</h1>
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
                </div>
            </div>
        </div>
    );
}

