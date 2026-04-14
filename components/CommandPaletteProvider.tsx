"use client";

import { createContext, useContext, useState, useEffect } from "react";
import CommandPalette from "./CommandPalette";

const Ctx = createContext<{ open: () => void }>({ open: () => {} });
export const useCommandPalette = () => useContext(Ctx);

export default function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <Ctx.Provider value={{ open: () => setIsOpen(true) }}>
      {children}
      <CommandPalette open={isOpen} onClose={() => setIsOpen(false)} />
    </Ctx.Provider>
  );
}
