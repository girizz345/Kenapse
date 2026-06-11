-- ============================================================
-- Add pdf_images column to study_materials
-- Run once in Supabase SQL Editor → New query → Run
-- ============================================================
ALTER TABLE public.study_materials
  ADD COLUMN IF NOT EXISTS pdf_images JSONB DEFAULT '[]'::jsonb;
