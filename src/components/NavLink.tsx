import { NavLink as RouterNavLink, NavLinkProps as RouterNavLinkProps } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * Extiende las propiedades de NavLink de react-router-dom para aceptar una función
 * en la prop `className` que recibe el estado de actividad del enlace.
 *
 * Esto permite un manejo de clases más declarativo y alineado con react-router-dom v6.
 */
interface NavLinkProps extends Omit<RouterNavLinkProps, "className"> {
  className?: string | ((props: { isActive: boolean; isPending: boolean }) => string);
}

export function NavLink({ className, ...props }: NavLinkProps) {
  return (
    <RouterNavLink
      {...props}
      className={({ isActive, isPending }) =>
        cn(typeof className === "function" ? className({ isActive, isPending }) : className)
      }
    />
  );
}