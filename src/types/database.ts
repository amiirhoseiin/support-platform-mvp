export type UserRole = 'customer' | 'agent' | 'founder';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type CustomerTier = 'small' | 'substantial' | 'enterprise';
export type TicketPriority = 'low' | 'normal' | 'high' | 'critical';
export type EventType =
  | 'created'
  | 'status_changed'
  | 'priority_changed'
  | 'assigned'
  | 'note_added'
  | 'resolved';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tier: CustomerTier;
  avatar_url?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

export interface Ticket {
  id: string;
  customer_id: string;
  assigned_agent_id?: string | null;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  tags?: string[];
  metadata?: Record<string, unknown>;
  first_responded_at?: string | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at?: string;
  customer?: UserProfile;
  assigned_agent?: UserProfile;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  body: string;
  is_internal_note: boolean;
  is_ai_draft: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
  sender?: UserProfile;
}

export interface TicketEvent {
  id: string;
  ticket_id: string;
  actor_id?: string | null;
  action: EventType;
  old_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
  created_at: string;
  actor?: UserProfile;
}

