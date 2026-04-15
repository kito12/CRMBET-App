"use client";

import { useState } from "react";
import type { Ticket, TicketStatus } from "@/lib/data";
import { PriorityPill } from "@/components/ui/StatusPill";
import { GripVertical, User } from "lucide-react";

const COLUMNS: {
  status: TicketStatus;
  label: string;
  dot: string;
  pill: string;
  pillText: string;
  accent: string;
}[] = [
  { status: "Open",        label: "Open",        dot: "bg-purple-400",  pill: "bg-purple-50",  pillText: "text-purple-700",  accent: "border-purple-300" },
  { status: "In Progress", label: "In Progress", dot: "bg-blue-400",    pill: "bg-blue-50",    pillText: "text-blue-700",    accent: "border-blue-300" },
  { status: "On Hold",     label: "On Hold",     dot: "bg-amber-400",   pill: "bg-amber-50",   pillText: "text-amber-700",   accent: "border-amber-300" },
  { status: "Resolved",    label: "Resolved",    dot: "bg-emerald-400", pill: "bg-emerald-50", pillText: "text-emerald-700", accent: "border-emerald-300" },
];

interface Props {
  tickets: Ticket[];
  onUpdateStatus: (id: string, status: TicketStatus) => void;
  onSelect: (ticket: Ticket) => void;
}

export default function KanbanBoard({ tickets, onUpdateStatus, onSelect }: Props) {
  const [draggingId, setDraggingId]   = useState<string | null>(null);
  const [overColumn, setOverColumn]   = useState<TicketStatus | null>(null);
  const [overCardId, setOverCardId]   = useState<string | null>(null);

  function handleDragStart(e: React.DragEvent, ticketId: string) {
    setDraggingId(ticketId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("ticketId", ticketId);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setOverColumn(null);
    setOverCardId(null);
  }

  function handleColumnDragOver(e: React.DragEvent, status: TicketStatus) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverColumn(status);
  }

  function handleColumnDrop(e: React.DragEvent, status: TicketStatus) {
    e.preventDefault();
    const id = e.dataTransfer.getData("ticketId") || draggingId;
    if (id) onUpdateStatus(id, status);
    setDraggingId(null);
    setOverColumn(null);
    setOverCardId(null);
  }

  function handleColumnDragLeave(e: React.DragEvent) {
    // Only clear if leaving the column entirely (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setOverColumn(null);
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {COLUMNS.map(({ status, label, dot, pill, pillText, accent }) => {
        const col     = tickets.filter(t => t.status === status);
        const isOver  = overColumn === status;

        return (
          <div
            key={status}
            className={`flex flex-col rounded-2xl transition-all duration-150 ${isOver ? `ring-2 ${accent}` : ""}`}
            style={{
              background: isOver ? "rgba(113,49,214,0.03)" : "var(--surface-lowest)",
              boxShadow: "0 4px 24px 0 rgba(26,28,28,0.06)",
              minHeight: 200,
            }}
            onDragOver={e => handleColumnDragOver(e, status)}
            onDrop={e => handleColumnDrop(e, status)}
            onDragLeave={handleColumnDragLeave}
          >
            {/* Column header */}
            <div className="flex items-center gap-2.5 px-4 py-3.5 flex-shrink-0"
              style={{ borderBottom: "1px solid rgba(204,195,215,0.12)" }}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
              <span className="text-sm font-semibold text-[#1a1c1c]">{label}</span>
              <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-bold ${pill} ${pillText}`}>
                {col.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 flex flex-col gap-2 p-3 overflow-y-auto" style={{ maxHeight: "calc(100vh - 340px)" }}>
              {col.length === 0 && (
                <div className={`flex-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-10 transition-colors ${isOver ? `${accent} bg-purple-50/30` : ""}`}
                  style={{ borderColor: isOver ? undefined : "rgba(204,195,215,0.25)" }}>
                  <span className="text-xs text-[#48484a]">{isOver ? "Drop to move here" : "No tickets"}</span>
                </div>
              )}

              {col.map(ticket => {
                const isDragging = draggingId === ticket.id;
                const isOver2    = overCardId === ticket.id;
                return (
                  <div
                    key={ticket.id}
                    draggable
                    onDragStart={e => handleDragStart(e, ticket.id)}
                    onDragEnd={handleDragEnd}
                    onDragEnter={() => setOverCardId(ticket.id)}
                    onDragLeave={() => setOverCardId(null)}
                    onClick={() => !isDragging && onSelect(ticket)}
                    className={`group relative rounded-xl p-3.5 cursor-grab active:cursor-grabbing transition-all duration-150 select-none ${
                      isDragging ? "opacity-30 scale-[0.97] rotate-1" : "hover:-translate-y-0.5"
                    } ${isOver2 ? "ring-1 ring-purple-300" : ""}`}
                    style={{
                      background: "var(--surface-low)",
                      boxShadow: isDragging ? "none" : "0 2px 10px rgba(26,28,28,0.07)",
                    }}
                  >
                    {/* Drag handle */}
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-40 transition-opacity">
                      <GripVertical size={13} className="text-[#48484a]" />
                    </div>

                    {/* Ticket ID + priority */}
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="text-xs font-bold text-purple-600">{ticket.id}</span>
                      <PriorityPill priority={ticket.priority} />
                    </div>

                    {/* Customer */}
                    <p className="text-sm font-semibold text-[#1a1c1c] mb-0.5 leading-snug pr-4">{ticket.customer}</p>
                    <p className="text-xs text-[#48484a] mb-3 leading-relaxed">{ticket.issue}</p>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2.5"
                      style={{ borderTop: "1px solid rgba(204,195,215,0.15)" }}>
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-md gradient-primary flex items-center justify-center flex-shrink-0">
                          <User size={9} className="text-white" />
                        </div>
                        <span className="text-xs text-[#48484a] truncate max-w-[80px]">{ticket.agent}</span>
                      </div>
                      <span className="text-[10px] text-[#48484a]">{ticket.created}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
