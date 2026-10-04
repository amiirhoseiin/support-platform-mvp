-- Migration: Fix app_settings RLS policies to use is_staff() and provide explicit WITH CHECK clauses
-- This resolves the error when a founder or staff member activates or updates auto-reply settings.

DROP POLICY IF EXISTS "Staff view settings" ON public.app_settings;
DROP POLICY IF EXISTS "Founder update settings" ON public.app_settings;
DROP POLICY IF EXISTS "Staff insert settings" ON public.app_settings;
DROP POLICY IF EXISTS "Staff update settings" ON public.app_settings;

CREATE POLICY "Staff view settings" ON public.app_settings
  FOR SELECT
  USING (public.is_staff());

CREATE POLICY "Staff insert settings" ON public.app_settings
  FOR INSERT
  WITH CHECK (public.is_staff());

CREATE POLICY "Staff update settings" ON public.app_settings
  FOR UPDATE
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

