-- Create SECURITY DEFINER function to prevent infinite recursion
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('agent', 'founder')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop recursive policies
DROP POLICY IF EXISTS "Staff view all users" ON public.users;
CREATE POLICY "Staff view all users" ON public.users FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS "Staff view all tickets" ON public.tickets;
CREATE POLICY "Staff view all tickets" ON public.tickets FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS "Staff update all tickets" ON public.tickets;
CREATE POLICY "Staff update all tickets" ON public.tickets FOR UPDATE USING (public.is_staff());

DROP POLICY IF EXISTS "Staff view all messages" ON public.messages;
CREATE POLICY "Staff view all messages" ON public.messages FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS "Staff insert messages" ON public.messages;
CREATE POLICY "Staff insert messages" ON public.messages FOR INSERT WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Staff update messages" ON public.messages;
CREATE POLICY "Staff update messages" ON public.messages FOR UPDATE USING (public.is_staff());

DROP POLICY IF EXISTS "Staff delete messages" ON public.messages;
CREATE POLICY "Staff delete messages" ON public.messages FOR DELETE USING (public.is_staff());

-- Add missing policies for ticket_events
DROP POLICY IF EXISTS "Staff view all events" ON public.ticket_events;
CREATE POLICY "Staff view all events" ON public.ticket_events FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS "Staff insert events" ON public.ticket_events;
CREATE POLICY "Staff insert events" ON public.ticket_events FOR INSERT WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Customers view own ticket events" ON public.ticket_events;
CREATE POLICY "Customers view own ticket events" ON public.ticket_events FOR SELECT USING (EXISTS (SELECT 1 FROM public.tickets WHERE id = ticket_events.ticket_id AND customer_id = auth.uid()));

DROP POLICY IF EXISTS "Customers insert own ticket events" ON public.ticket_events;
CREATE POLICY "Customers insert own ticket events" ON public.ticket_events FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.tickets WHERE id = ticket_events.ticket_id AND customer_id = auth.uid()));
