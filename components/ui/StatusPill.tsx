type Status = "Open" | "In Progress" | "Resolved" | "On Hold";
type Priority = "High" | "Medium" | "Low";

const statusStyles: Record<Status, string> = {
  Open: "bg-purple-50 text-purple-700",
  "In Progress": "bg-blue-50 text-blue-700",
  Resolved: "bg-emerald-50 text-emerald-700",
  "On Hold": "bg-amber-50 text-amber-700",
};

const priorityStyles: Record<Priority, string> = {
  High: "bg-red-50 text-red-600",
  Medium: "bg-orange-50 text-orange-600",
  Low: "bg-slate-100 text-slate-500",
};

export function StatusPill({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[status]}`}>
      {status}
    </span>
  );
}

export function PriorityPill({ priority }: { priority: Priority }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityStyles[priority]}`}>
      {priority}
    </span>
  );
}
