export type TicketStatus = "Open" | "In Progress" | "Resolved" | "On Hold";
export type TicketPriority = "High" | "Medium" | "Low";
export type AccountType = "Standard" | "Premium" | "VIP";
export type CustomerStatus = "Active" | "Suspended" | "Inactive";
export type NotificationType = "assigned" | "sla_breach" | "escalated" | "new_ticket" | "status_change";

export interface Customer {
  clientId: string;
  name: string;
  email: string;
  phone: string;
  accountType: AccountType;
  status: CustomerStatus;
  country: string;
  createdAt: string;
}

export interface Note {
  id: string;
  author: string;
  text: string;
  timestamp: string;
}

export type AuditAction = "created" | "status_changed" | "agent_changed" | "priority_changed" | "escalated" | "note_added";

export interface AuditEntry {
  id: string;
  action: AuditAction;
  from?: string;
  to?: string;
  author: string;
  timestamp: string;
}

export interface Ticket {
  id: string;
  clientId: string;
  customer: string;
  email: string;
  phone: string;
  issue: string;
  priority: TicketPriority;
  status: TicketStatus;
  agent: string;
  created: string;       // human-readable label (local time at creation)
  createdAt?: string;    // ISO 8601 — for accurate cross-timezone display & sorting
  description?: string;
  headOfficeUrl?: string;
  notes?: Note[];
  escalated?: boolean;
  escalatedAt?: string;
  escalatedTo?: string;
  resolvedAt?: string;    // ISO 8601 — set when status first changes to Resolved
  source?: "web_form" | "agent";
  auditLog?: AuditEntry[];
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  ticketId: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface CannedResponse {
  id: string;
  title: string;
  category: string;
  body: string;
}

export interface EscalationSettings {
  enabled: boolean;
  thresholdHours: number;
  tier2Agent: string;
  headOfficeUrl: string;
}

export const defaultEscalationSettings: EscalationSettings = {
  enabled: true,
  thresholdHours: 4,
  tier2Agent: "James R.",
  headOfficeUrl: "",
};

export const seedNotifications: AppNotification[] = [
  { id: "n1", type: "assigned",   ticketId: "TKT-1042", message: "TKT-1042 assigned to you by Tom H.",          timestamp: "09:14", read: false },
  { id: "n2", type: "sla_breach", ticketId: "TKT-1040", message: "TKT-1040 has breached SLA — unassigned 2h+",  timestamp: "08:50", read: false },
  { id: "n3", type: "new_ticket", ticketId: "TKT-1034", message: "New high-priority ticket from Ahmed Al-Rashid",timestamp: "08:10", read: true  },
  { id: "n4", type: "escalated",  ticketId: "TKT-1039", message: "TKT-1039 escalated to Tier 2 by Tom H.",      timestamp: "Yesterday", read: true },
];

export const seedCannedResponses: CannedResponse[] = [
  {
    id: "cr1",
    title: "Withdrawal Hold – KYC Required",
    category: "Withdrawal",
    body: "Hi {{customer_name}}, thank you for reaching out. Your withdrawal is currently on hold as we need to verify your identity. Please submit a valid government-issued ID and proof of address to complete the KYC process. Once verified, your withdrawal will be processed within 24–48 hours.",
  },
  {
    id: "cr2",
    title: "Bet Settlement Dispute",
    category: "Bet Settlement",
    body: "Hi {{customer_name}}, we've reviewed your query regarding the bet settlement on your account. Settlements are processed based on official results from our data provider. If you believe there has been an error, please provide the bet ID and event details so our team can investigate further.",
  },
  {
    id: "cr3",
    title: "Account Access – Password Reset",
    category: "Account Access",
    body: "Hi {{customer_name}}, we're sorry to hear you're having trouble accessing your account. Please use the 'Forgot Password' link on the login page to reset your credentials. If the issue persists, our team can manually verify your identity and restore access within 1 business day.",
  },
  {
    id: "cr4",
    title: "Bonus Terms Clarification",
    category: "Bonus Dispute",
    body: "Hi {{customer_name}}, thank you for your message regarding your bonus. Bonuses are subject to our standard wagering requirements of 5x the bonus amount before withdrawal. You can track your progress in the 'Promotions' section of your account. Let us know if you have any further questions.",
  },
  {
    id: "cr5",
    title: "Live Betting Technical Issue",
    category: "Live Betting",
    body: "Hi {{customer_name}}, we're aware of intermittent issues with our live betting platform and apologise for the inconvenience. Our technical team is working on a fix. In the meantime, please try clearing your browser cache or using our mobile app. We'll notify you once the issue is resolved.",
  },
  {
    id: "cr6",
    title: "Standard Acknowledgment",
    category: "General",
    body: "Hi {{customer_name}}, thank you for contacting our support team. We've received your request and a member of our team will be in touch within 2–4 hours. Your reference number is {{ticket_id}}. We apologise for any inconvenience caused.",
  },
];

export const customers: Customer[] = [
  { clientId: "CLT-10042", name: "Marcus Webb",      email: "m.webb@email.com",  phone: "+1 555 012 3456",  accountType: "VIP",      status: "Active",    country: "United States", createdAt: "Jan 12, 2024" },
  { clientId: "CLT-10041", name: "Priya Nair",       email: "p.nair@email.com",  phone: "+44 7700 900123", accountType: "Premium",  status: "Active",    country: "United Kingdom", createdAt: "Feb 3, 2024" },
  { clientId: "CLT-10040", name: "Leo Fernandez",    email: "l.fern@email.com",  phone: "+34 612 345 678", accountType: "Standard", status: "Active",    country: "Spain",         createdAt: "Mar 19, 2024" },
  { clientId: "CLT-10039", name: "Amber Chen",       email: "a.chen@email.com",  phone: "+1 555 987 6543", accountType: "Premium",  status: "Active",    country: "United States", createdAt: "Nov 5, 2023" },
  { clientId: "CLT-10038", name: "David Osei",       email: "d.osei@email.com",  phone: "+233 24 123 4567",accountType: "Standard", status: "Active",    country: "Ghana",         createdAt: "Apr 1, 2024" },
  { clientId: "CLT-10037", name: "Nina Patel",       email: "n.patel@email.com", phone: "+91 98765 43210", accountType: "VIP",      status: "Active",    country: "India",         createdAt: "Sep 14, 2023" },
  { clientId: "CLT-10036", name: "Carlos Mendez",    email: "c.mend@email.com",  phone: "+52 55 1234 5678",accountType: "Standard", status: "Inactive",  country: "Mexico",        createdAt: "Jun 22, 2023" },
  { clientId: "CLT-10035", name: "Sophie Turner",    email: "s.turn@email.com",  phone: "+44 7911 123456", accountType: "Standard", status: "Active",    country: "United Kingdom", createdAt: "Dec 8, 2023" },
  { clientId: "CLT-10034", name: "Ahmed Al-Rashid",  email: "a.rash@email.com",  phone: "+971 50 123 4567",accountType: "VIP",      status: "Active",    country: "UAE",           createdAt: "Jul 30, 2023" },
  { clientId: "CLT-10033", name: "Emma Johnson",     email: "e.john@email.com",  phone: "+1 555 246 8135", accountType: "Premium",  status: "Suspended", country: "United States", createdAt: "Oct 17, 2023" },
];

export const tickets: Ticket[] = [
  { id: "TKT-1042", clientId: "CLT-10042", customer: "Marcus Webb",     email: "m.webb@email.com",  phone: "+1 555 012 3456",  issue: "Withdrawal Issue", priority: "High",   status: "Open",        agent: "Sarah K.", created: "Apr 14, 09:12", description: "Customer unable to withdraw funds after 3 attempts." },
  { id: "TKT-1041", clientId: "CLT-10041", customer: "Priya Nair",      email: "p.nair@email.com",  phone: "+44 7700 900123",  issue: "Bet Settlement",   priority: "Medium", status: "In Progress", agent: "James R.", created: "Apr 14, 09:00", description: "Disputed bet result on Premier League match." },
  { id: "TKT-1040", clientId: "CLT-10040", customer: "Leo Fernandez",   email: "l.fern@email.com",  phone: "+34 612 345 678",  issue: "Account Access",   priority: "High",   status: "Open",        agent: "Unassigned", created: "Apr 14, 08:44" },
  { id: "TKT-1039", clientId: "CLT-10039", customer: "Amber Chen",      email: "a.chen@email.com",  phone: "+1 555 987 6543",  issue: "Bonus Dispute",    priority: "Medium", status: "In Progress", agent: "Tom H.",   created: "Apr 14, 08:10" },
  { id: "TKT-1038", clientId: "CLT-10038", customer: "David Osei",      email: "d.osei@email.com",  phone: "+233 24 123 4567", issue: "Live Betting",     priority: "Low",    status: "Resolved",    agent: "Sarah K.", created: "Apr 14, 07:55" },
  { id: "TKT-1037", clientId: "CLT-10037", customer: "Nina Patel",      email: "n.patel@email.com", phone: "+91 98765 43210",  issue: "Withdrawal Issue", priority: "High",   status: "Resolved",    agent: "James R.", created: "Apr 14, 07:30" },
  { id: "TKT-1036", clientId: "CLT-10036", customer: "Carlos Mendez",   email: "c.mend@email.com",  phone: "+52 55 1234 5678", issue: "Account Access",   priority: "Low",    status: "Open",        agent: "Unassigned", created: "Apr 13, 18:22" },
  { id: "TKT-1035", clientId: "CLT-10035", customer: "Sophie Turner",   email: "s.turn@email.com",  phone: "+44 7911 123456",  issue: "Bet Settlement",   priority: "Medium", status: "On Hold",     agent: "Tom H.",   created: "Apr 13, 17:40" },
  { id: "TKT-1034", clientId: "CLT-10034", customer: "Ahmed Al-Rashid", email: "a.rash@email.com",  phone: "+971 50 123 4567", issue: "Bonus Dispute",    priority: "High",   status: "Open",        agent: "Sarah K.", created: "Apr 13, 16:15" },
  { id: "TKT-1033", clientId: "CLT-10033", customer: "Emma Johnson",    email: "e.john@email.com",  phone: "+1 555 246 8135",  issue: "Live Betting",     priority: "Low",    status: "Resolved",    agent: "James R.", created: "Apr 13, 15:00" },
  // Historical tickets for returning customers
  { id: "TKT-1021", clientId: "CLT-10042", customer: "Marcus Webb",     email: "m.webb@email.com",  phone: "+1 555 012 3456",  issue: "Withdrawal Issue", priority: "High",   status: "Resolved",    agent: "Tom H.",   created: "Mar 28, 10:15" },
  { id: "TKT-1009", clientId: "CLT-10042", customer: "Marcus Webb",     email: "m.webb@email.com",  phone: "+1 555 012 3456",  issue: "Bonus Dispute",    priority: "Medium", status: "Resolved",    agent: "Sarah K.", created: "Feb 14, 14:30" },
  { id: "TKT-1028", clientId: "CLT-10037", customer: "Nina Patel",      email: "n.patel@email.com", phone: "+91 98765 43210",  issue: "Account Access",   priority: "Medium", status: "Resolved",    agent: "James R.", created: "Apr 2, 11:00" },
  { id: "TKT-1019", clientId: "CLT-10034", customer: "Ahmed Al-Rashid", email: "a.rash@email.com",  phone: "+971 50 123 4567", issue: "Withdrawal Issue", priority: "High",   status: "Resolved",    agent: "Sarah K.", created: "Mar 10, 09:45" },
];
