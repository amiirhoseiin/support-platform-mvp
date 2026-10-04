-- Migration: 20261004043000_ai_auto_reply_permissions_and_rpc.sql
-- 1. Allow authenticated users to view app_settings (so customers can read auto_reply config during ticket creation)
-- 2. Provide public.apply_ai_triage SECURITY DEFINER function to atomically apply AI classification,
--    auto-replies, and drafts without violating customer RLS boundary on tickets table.

DROP POLICY IF EXISTS "Staff view settings" ON public.app_settings;
DROP POLICY IF EXISTS "Authenticated view settings" ON public.app_settings;
CREATE POLICY "Authenticated view settings" ON public.app_settings
  FOR SELECT TO authenticated
  USING (true);

-- Atomic AI Triage Stored Procedure
CREATE OR REPLACE FUNCTION public.apply_ai_triage(
  p_ticket_id UUID,
  p_category TEXT,
  p_confidence NUMERIC,
  p_reasoning TEXT,
  p_auto_reply_body TEXT DEFAULT NULL,
  p_draft_body TEXT DEFAULT NULL,
  p_provider TEXT DEFAULT 'google_gemini',
  p_similar_tickets JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket RECORD;
  v_sender_id UUID;
  v_msg_id UUID;
BEGIN
  -- 1. Verify ticket exists and caller has authority (customer owner or staff)
  SELECT * INTO v_ticket FROM public.tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket not found');
  END IF;

  IF auth.uid() <> v_ticket.customer_id AND NOT public.is_staff() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- 2. Determine support sender ID (founder, agent, or assigned agent)
  SELECT id INTO v_sender_id FROM public.users WHERE role = 'founder' LIMIT 1;
  IF v_sender_id IS NULL THEN
    SELECT id INTO v_sender_id FROM public.users WHERE role = 'agent' LIMIT 1;
  END IF;
  IF v_sender_id IS NULL THEN
    v_sender_id := v_ticket.customer_id;
  END IF;

  -- 3. Safely update ticket metadata with AI classification
  UPDATE public.tickets
  SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'ai_classification', jsonb_build_object(
      'category', p_category,
      'confidence', p_confidence,
      'reasoning', p_reasoning,
      'classified_at', NOW()
    )
  )
  WHERE id = p_ticket_id;

  -- 4. Execute Auto-Reply if text provided
  IF p_auto_reply_body IS NOT NULL AND length(trim(p_auto_reply_body)) > 0 THEN
    INSERT INTO public.messages (
      ticket_id,
      sender_id,
      body,
      is_internal_note,
      is_ai_draft,
      metadata
    ) VALUES (
      p_ticket_id,
      v_sender_id,
      p_auto_reply_body,
      FALSE,
      FALSE,
      jsonb_build_object(
        'auto_replied', true,
        'human_reviewed', false,
        'is_ai_assisted', true,
        'classification', p_category,
        'confidence', p_confidence,
        'reasoning', p_reasoning,
        'similar_tickets', p_similar_tickets,
        'model', p_provider
      )
    ) RETURNING id INTO v_msg_id;

    -- Advance ticket response time and set in_progress (NEVER auto-close!)
    UPDATE public.tickets
    SET
      first_responded_at = COALESCE(first_responded_at, NOW()),
      status = 'in_progress'
    WHERE id = p_ticket_id;

    -- Audit log status change
    INSERT INTO public.ticket_events (
      ticket_id,
      actor_id,
      action,
      new_value
    ) VALUES (
      p_ticket_id,
      v_sender_id,
      'status_changed',
      jsonb_build_object(
        'auto_replied', true,
        'status', 'in_progress',
        'message_id', v_msg_id,
        'category', p_category,
        'confidence', p_confidence
      )
    );

    RETURN jsonb_build_object('success', true, 'auto_replied', true, 'message_id', v_msg_id);

  -- 5. Otherwise, store staff draft if provided
  ELSIF p_draft_body IS NOT NULL AND length(trim(p_draft_body)) > 0 THEN
    INSERT INTO public.messages (
      ticket_id,
      sender_id,
      body,
      is_internal_note,
      is_ai_draft,
      metadata
    ) VALUES (
      p_ticket_id,
      v_sender_id,
      p_draft_body,
      FALSE,
      TRUE,
      jsonb_build_object(
        'auto_replied', false,
        'human_reviewed', false,
        'is_ai_draft', true,
        'classification', p_category,
        'confidence', p_confidence,
        'reasoning', p_reasoning,
        'similar_tickets', p_similar_tickets,
        'model', p_provider
      )
    ) RETURNING id INTO v_msg_id;

    RETURN jsonb_build_object('success', true, 'auto_replied', false, 'message_id', v_msg_id);
  END IF;

  RETURN jsonb_build_object('success', true, 'auto_replied', false);
END;
$$;
