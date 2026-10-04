-- Migration: Allow authenticated users to view staff (agent & founder) profiles
-- This ensures that when an agent replies or approves an AI draft, their name and role
-- correctly render for the customer in the conversation thread.
DROP POLICY IF EXISTS "Customers view staff profiles" ON public.users;
CREATE POLICY "Customers view staff profiles" ON public.users
FOR SELECT USING (
  role IN ('agent', 'founder')
);

