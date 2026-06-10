import { useState } from 'react';
import { LayoutGrid } from 'lucide-react';

export default function App() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#09090b] text-white">
      <div className="text-center p-8 border border-zinc-800 bg-zinc-900/50 rounded-3xl backdrop-blur-xl">
        <LayoutGrid className="w-16 h-16 text-[#00f2ff] mx-auto mb-6" />
        <h1 className="text-3xl font-bold mb-2">Farmaplus Sheets</h1>
        <p className="text-zinc-400">Si ves esto, el sistema de renderizado está OK.</p>
        <div className="mt-8 px-6 py-2 bg-[#00f2ff] text-black font-bold rounded-xl animate-pulse">
          Cargando Grilla de Alto Rendimiento...
        </div>
      </div>
    </div>
  );
}
