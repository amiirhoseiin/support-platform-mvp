TRUNCATE public.users, public.tickets, public.messages, public.ticket_events CASCADE;
DELETE FROM auth.users WHERE email IN ('founder@company.com', 'mike@company.com', 'anna@company.com', 'cto@acmecorp.com', 'admin@novintech.ir', 'hello@startup.io');

DO $$
DECLARE
  founder_id UUID := '11111111-1111-1111-1111-111111111111';
  agent_mike_id UUID := '22222222-2222-2222-2222-222222222222';
  agent_anna_id UUID := '33333333-3333-3333-3333-333333333333';
  vip_client_id UUID := '44444444-4444-4444-4444-444444444444';
  persian_client_id UUID := '55555555-5555-5555-5555-555555555555';
  normal_client_id UUID := '66666666-6666-6666-6666-666666666666';
BEGIN

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) VALUES
(founder_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'founder@company.com', crypt('demo123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, NOW(), NOW(), '', '', '', ''),
(agent_mike_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mike@company.com', crypt('demo123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, NOW(), NOW(), '', '', '', ''),
(agent_anna_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'anna@company.com', crypt('demo123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, NOW(), NOW(), '', '', '', ''),
(vip_client_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cto@acmecorp.com', crypt('demo123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, NOW(), NOW(), '', '', '', ''),
(persian_client_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@novintech.ir', crypt('demo123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, NOW(), NOW(), '', '', '', ''),
(normal_client_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'hello@startup.io', crypt('demo123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, NOW(), NOW(), '', '', '', '');

INSERT INTO public.users (id, email, name, role, tier, metadata) VALUES
(founder_id, 'founder@company.com', 'Sarah (Founder)', 'founder', 'small', '{"timezone": "UTC"}'::jsonb),
(agent_mike_id, 'mike@company.com', 'Mike (L2 Support)', 'agent', 'small', '{"specialty": "technical"}'::jsonb),
(agent_anna_id, 'anna@company.com', 'Anna (L1 Support)', 'agent', 'small', '{"specialty": "billing"}'::jsonb),
(vip_client_id, 'cto@acmecorp.com', 'Acme Corp (VIP)', 'customer', 'enterprise', '{"company_size": 500}'::jsonb),
(persian_client_id, 'admin@novintech.ir', 'Novin Tech (Persian)', 'customer', 'substantial', '{"language": "fa"}'::jsonb),
(normal_client_id, 'hello@startup.io', 'Startup Studio', 'customer', 'small', '{}'::jsonb);

INSERT INTO public.tickets (id, customer_id, assigned_agent_id, subject, description, status, priority, tags, first_responded_at, resolved_at, created_at) VALUES
('a1111111-1111-1111-1111-111111111111', vip_client_id, agent_mike_id, 'CRITICAL: Database connection dropping', 'Our main application is losing connection to your API every 5 minutes. This is heavily affecting our users.', 'in_progress', 'critical', ARRAY['bug', 'database'], NOW() - INTERVAL '4 hours', NULL, NOW() - INTERVAL '5 hours'),
('b2222222-2222-2222-2222-222222222222', persian_client_id, NULL, 'تغییر اطلاعات حقوقی در فاکتور', 'با سلام. لطفاً نام شرکت در فاکتورهای ماهانه را از "نوین" به "نوین تک" تغییر دهید. شناسه ملی هم تغییر کرده است.', 'open', 'normal', ARRAY['billing'], NULL, NULL, NOW() - INTERVAL '1 hour'),
('c3333333-3333-3333-3333-333333333333', normal_client_id, agent_anna_id, 'How to invite team members?', 'I cannot find the button to add my co-founder to the workspace.', 'resolved', 'low', ARRAY['onboarding'], NOW() - INTERVAL '3 days 23 hours', NOW() - INTERVAL '3 days 20 hours', NOW() - INTERVAL '4 days');

INSERT INTO public.messages (ticket_id, sender_id, body, is_internal_note, is_ai_draft, created_at, metadata) VALUES
('a1111111-1111-1111-1111-111111111111', vip_client_id, 'Are there any updates? We are losing revenue.', false, false, NOW() - INTERVAL '3 hours', '{}'::jsonb),
('a1111111-1111-1111-1111-111111111111', agent_mike_id, 'Investigating the connection pool limits on the replica databases right now.', false, false, NOW() - INTERVAL '2 hours 50 minutes', '{}'::jsonb),
('a1111111-1111-1111-1111-111111111111', agent_mike_id, '[URGENT] Sarah, can you check the AWS dashboard? I think we hit the IOPS limit on their tenant.', true, false, NOW() - INTERVAL '1 hour', '{}'::jsonb),
('b2222222-2222-2222-2222-222222222222', founder_id, '[AI Summary]: Customer wants to change their legal company name from "Novin" to "Novin Tech" on monthly invoices, and also update their national ID.', true, false, NOW() - INTERVAL '45 minutes', '{"source": "ai_agent"}'::jsonb),
('b2222222-2222-2222-2222-222222222222', founder_id, 'سلام. درخواست شما دریافت شد. لطفاً شناسه ملی جدید را ارسال کنید تا اطلاعات حقوقی فاکتور شما را در سیستم بروزرسانی کنم.', false, true, NOW() - INTERVAL '10 minutes', '{"ai_model": "gemini-flash-latest", "detected_language": "fa"}'::jsonb),
('c3333333-3333-3333-3333-333333333333', agent_anna_id, 'Hi! You can invite your co-founder by going to Settings > Team Members > Invite, entering their email, and selecting their permission role.', false, false, NOW() - INTERVAL '3 days 20 hours', '{}'::jsonb);

INSERT INTO public.app_settings (key, value)
VALUES (
  'auto_reply',
  '{"enabled": false, "min_confidence": 0.85, "allowed_categories": ["duplicate_question", "feature_request"], "excluded_categories": ["billing", "security", "bug"]}'::jsonb
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;


INSERT INTO public.ticket_events (ticket_id, actor_id, action, old_value, new_value, created_at) VALUES
('a1111111-1111-1111-1111-111111111111', vip_client_id, 'created', NULL, '{"status": "open", "priority": "critical"}'::jsonb, NOW() - INTERVAL '5 hours'),
('a1111111-1111-1111-1111-111111111111', agent_mike_id, 'assigned', '{"assigned_agent_id": null}'::jsonb, '{"assigned_agent_id": "22222222-2222-2222-2222-222222222222"}'::jsonb, NOW() - INTERVAL '4 hours 30 minutes'),
('a1111111-1111-1111-1111-111111111111', agent_mike_id, 'status_changed', '{"status": "open"}'::jsonb, '{"status": "in_progress"}'::jsonb, NOW() - INTERVAL '4 hours'),
('c3333333-3333-3333-3333-333333333333', agent_anna_id, 'resolved', '{"status": "open"}'::jsonb, '{"status": "resolved"}'::jsonb, NOW() - INTERVAL '3 days 20 hours');

END $$;