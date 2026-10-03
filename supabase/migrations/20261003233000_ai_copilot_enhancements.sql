-- Migration: 20261003233000_ai_copilot_enhancements.sql
-- Adds app_settings table for configurable auto-reply and safety policy
-- and adds category to tickets metadata.

CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.users(id)
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Staff can view settings
DROP POLICY IF EXISTS "Staff view settings" ON public.app_settings;
CREATE POLICY "Staff view settings" ON public.app_settings
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('agent', 'founder')
  ));

-- Founder can update settings
DROP POLICY IF EXISTS "Founder update settings" ON public.app_settings;
CREATE POLICY "Founder update settings" ON public.app_settings
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('agent', 'founder')
  ));

-- Seed default auto-reply settings (DISABLED by default)
INSERT INTO public.app_settings (key, value)
VALUES (
  'auto_reply',
  '{
    "enabled": false,
    "min_confidence": 0.85,
    "allowed_categories": ["duplicate_question", "feature_request"],
    "excluded_categories": ["billing", "security", "bug"]
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

