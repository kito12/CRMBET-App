"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { customers as seedCustomers, tickets as seedTickets } from "@/lib/data";
import type { Customer, Ticket } from "@/lib/data";

interface DataContextType {
  tickets: Ticket[];
  setTickets: React.Dispatch<React.SetStateAction<Ticket[]>>;
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  resetData: () => void;
  hydrated: boolean;
}

const DataContext = createContext<DataContextType | null>(null);

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}

export default function DataProvider({ children }: { children: React.ReactNode }) {
  const [tickets, setTickets]     = useState<Ticket[]>(seedTickets);
  const [customers, setCustomers] = useState<Customer[]>(seedCustomers);
  const [hydrated, setHydrated]   = useState(false);

  // Hydrate from localStorage once on mount
  useEffect(() => {
    try {
      const t = localStorage.getItem("crm-tickets");
      const c = localStorage.getItem("crm-customers");
      if (t) setTickets(JSON.parse(t));
      if (c) setCustomers(JSON.parse(c));
    } catch {}
    setHydrated(true);
  }, []);

  // Persist tickets
  useEffect(() => {
    if (hydrated) localStorage.setItem("crm-tickets", JSON.stringify(tickets));
  }, [tickets, hydrated]);

  // Persist customers
  useEffect(() => {
    if (hydrated) localStorage.setItem("crm-customers", JSON.stringify(customers));
  }, [customers, hydrated]);

  const resetData = useCallback(() => {
    localStorage.removeItem("crm-tickets");
    localStorage.removeItem("crm-customers");
    setTickets(seedTickets);
    setCustomers(seedCustomers);
  }, []);

  return (
    <DataContext.Provider value={{ tickets, setTickets, customers, setCustomers, resetData, hydrated }}>
      {children}
    </DataContext.Provider>
  );
}
