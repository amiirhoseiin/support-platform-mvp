-- 1. Enums (دیکشنری وضعیت‌ها)
CREATE TYPE user_role AS ENUM ('customer', 'agent', 'founder');
CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE customer_tier AS ENUM ('small', 'substantial', 'enterprise');
CREATE TYPE ticket_priority AS ENUM ('low', 'normal', 'high', 'critical');
CREATE TYPE event_type AS ENUM ('created', 'status_changed', 'priority_changed', 'assigned', 'note_added', 'resolved');

-- 2. Users Table
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role user_role DEFAULT 'customer' NOT NULL,
  tier customer_tier DEFAULT 'small' NOT NULL,
  avatar_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tickets Table
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.users(id) NOT NULL,
  assigned_agent_id UUID REFERENCES public.users(id),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status ticket_status DEFAULT 'open' NOT NULL,
  priority ticket_priority DEFAULT 'normal' NOT NULL,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}'::jsonb, 
  first_responded_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Messages Table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.users(id),
  body TEXT NOT NULL,
  is_internal_note BOOLEAN DEFAULT FALSE NOT NULL,
  is_ai_draft BOOLEAN DEFAULT FALSE NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Ticket Events Table
CREATE TABLE public.ticket_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.users(id),
  action event_type NOT NULL,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. امنیت قطعی (Row Level Security)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_events ENABLE ROW LEVEL SECURITY;

-- قوانین دسترسی Users 
CREATE POLICY "Users view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Staff view all users" ON public.users FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('agent', 'founder')));

-- قوانین دسترسی Tickets
CREATE POLICY "Customers view own tickets" ON public.tickets FOR SELECT USING (auth.uid() = customer_id);
CREATE POLICY "Customers insert own tickets" ON public.tickets FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Staff view all tickets" ON public.tickets FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('agent', 'founder')));
CREATE POLICY "Staff update all tickets" ON public.tickets FOR UPDATE USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('agent', 'founder')));

-- قوانین دسترسی Messages (نوشته شده در یک خط برای جلوگیری از ارور نامرئی)
CREATE POLICY "Customers view public messages" ON public.messages FOR SELECT USING (is_internal_note = FALSE AND is_ai_draft = FALSE AND EXISTS (SELECT 1 FROM public.tickets WHERE id = messages.ticket_id AND customer_id = auth.uid()));
CREATE POLICY "Customers insert messages to own tickets" ON public.messages FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.tickets WHERE id = messages.ticket_id AND customer_id = auth.uid()));
CREATE POLICY "Staff view all messages" ON public.messages FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('agent', 'founder')));
CREATE POLICY "Staff insert messages" ON public.messages FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('agent', 'founder')));

-- 7. Trigger
CREATE OR REPLACE FUNCTION update_ticket_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER tr_update_ticket_timestamp BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE PROCEDURE update_ticket_timestamp();