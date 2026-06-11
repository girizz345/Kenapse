-- ============================================================
-- Add content_text column to chapters
-- Run once in Supabase SQL Editor → New query → Run
-- This stores a relevant excerpt from the uploaded material
-- per chapter, so lessons are grounded in the actual content.
-- ============================================================
ALTER TABLE public.chapters
  ADD COLUMN IF NOT EXISTS content_text TEXT DEFAULT '';
