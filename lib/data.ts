export type TicketStatus = "Open" | "In Progress" | "Resolved" | "On Hold";
export type TicketPriority = "High" | "Medium" | "Low";
export type AccountType = "Standard" | "Premium" | "VIP";
export type CustomerStatus = "Active" | "Suspended" | "Inactive";

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
  created: string;
  description?: string;
  headOfficeUrl?: string;
  notes?: Note[];
}

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
