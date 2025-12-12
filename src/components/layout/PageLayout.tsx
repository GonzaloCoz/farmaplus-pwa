import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function PageLayout({ children, className }: PageLayoutProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className={cn("container max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6", className)}
    >
      {children}
    </motion.div>
  );
}
