import { Ticket, CustomerTier, TicketPriority } from '@/types/database';

export const SLA_TARGETS_MINUTES: Record<CustomerTier, number> = {
  enterprise: 60, // 1 hour for Enterprise VIP
  substantial: 240, // 4 hours for Substantial tier
  small: 1440, // 24 hours for Small tier
};

export const RESOLUTION_SLA_MINUTES: Record<CustomerTier, number> = {
  enterprise: 240, // 4 hours resolution target
  substantial: 1440, // 24 hours resolution target
  small: 4320, // 72 hours resolution target
};

/**
 * Calculates first response time in minutes from creation to first_responded_at.
 */
export function getTicketResponseTimeMinutes(ticket: Ticket): number | null {
  if (!ticket.first_responded_at) return null;
  const created = new Date(ticket.created_at).getTime();
  const responded = new Date(ticket.first_responded_at).getTime();
  return Math.max(0, Math.floor((responded - created) / 60000));
}

/**
 * Calculates resolution time in minutes from creation to resolved_at.
 */
export function getTicketResolutionTimeMinutes(ticket: Ticket): number | null {
  if (!ticket.resolved_at) return null;
  const created = new Date(ticket.created_at).getTime();
  const resolved = new Date(ticket.resolved_at).getTime();
  return Math.max(0, Math.floor((resolved - created) / 60000));
}

/**
 * Determines whether a ticket has breached its first response SLA.
 */
export function isTicketSlaBreached(ticket: Ticket): boolean {
  const tier = (ticket.customer?.tier || 'small') as CustomerTier;
  const target = SLA_TARGETS_MINUTES[tier] || 1440;

  if (ticket.first_responded_at) {
    const elapsed = getTicketResponseTimeMinutes(ticket);
    return elapsed !== null && elapsed > target;
  }

  // If not responded yet and still active
  if (ticket.status !== 'resolved' && ticket.status !== 'closed') {
    const elapsedSoFar = Math.floor((Date.now() - new Date(ticket.created_at).getTime()) / 60000);
    return elapsedSoFar > target;
  }

  return false;
}

/**
 * Determines how many minutes are overdue, or negative if still within SLA.
 */
export function getSlaOverdueMinutes(ticket: Ticket): number {
  const tier = (ticket.customer?.tier || 'small') as CustomerTier;
  const target = SLA_TARGETS_MINUTES[tier] || 1440;

  if (ticket.first_responded_at) {
    const elapsed = getTicketResponseTimeMinutes(ticket) || 0;
    return elapsed - target;
  }

  const elapsedSoFar = Math.floor((Date.now() - new Date(ticket.created_at).getTime()) / 60000);
  return elapsedSoFar - target;
}

/**
 * A ticket is stale if it has had no activity for more than threshold hours.
 */
export function isTicketStale(ticket: Ticket, thresholdHours: number = 24): boolean {
  if (ticket.status === 'resolved' || ticket.status === 'closed') return false;
  const lastActive = new Date(ticket.updated_at || ticket.created_at).getTime();
  const idleHours = (Date.now() - lastActive) / (1000 * 60 * 60);
  return idleHours >= thresholdHours;
}

/**
 * Formats a duration in minutes into human-readable string.
 */
export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (hours < 24) {
    return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}
