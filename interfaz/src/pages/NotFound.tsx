import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <iframe 
      src="/camlboy/index.html" 
      title="Farmaplus - Game Boy Emulator" 
      className="fixed inset-0 w-full h-full border-none z-50 bg-[#0b0f19]"
    />
  );
};

export default NotFound;
