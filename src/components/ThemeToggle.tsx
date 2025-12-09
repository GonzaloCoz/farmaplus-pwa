import { Moon, Sun } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/hooks/useTheme";

export function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();

    return (
        <motion.button
            onClick={toggleTheme}
            className="relative flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Toggle theme"
        >
            <motion.div
                initial={false}
                animate={{
                    scale: theme === "dark" ? 1 : 0,
                    opacity: theme === "dark" ? 1 : 0,
                    rotate: theme === "dark" ? 0 : 180,
                }}
                transition={{ duration: 0.2 }}
                className="absolute"
            >
                <Moon className="w-4 h-4" />
            </motion.div>
            <motion.div
                initial={false}
                animate={{
                    scale: theme === "light" ? 1 : 0,
                    opacity: theme === "light" ? 1 : 0,
                    rotate: theme === "light" ? 0 : -180,
                }}
                transition={{ duration: 0.2 }}
                className="absolute"
            >
                <Sun className="w-4 h-4" />
            </motion.div>
        </motion.button>
    );
}
