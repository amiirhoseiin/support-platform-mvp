-- Migration: Add waiting_customer, waiting_internal, and reopened statuses
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'waiting_customer';
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'waiting_internal';
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'reopened';
