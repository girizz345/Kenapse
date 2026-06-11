-- Run this in the Supabase SQL editor before deploying the adaptation update.

ALTER TABLE public.quiz_results
  ADD COLUMN IF NOT EXISTS user_id        TEXT,
  ADD COLUMN IF NOT EXISTS misconceptions JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS focus_topics   JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS remediation    TEXT  DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_quiz_results_user_id
  ON public.quiz_results (user_id);

CREATE INDEX IF NOT EXISTS idx_quiz_results_chapter_user
  ON public.quiz_results (chapter_id, user_id, created_at DESC);

-- Required for upsert on (chapter_id, user_id) conflict target
ALTER TABLE public.quiz_results
  ADD CONSTRAINT uq_quiz_results_chapter_user
  UNIQUE (chapter_id, user_id);

-- ── Backfill: rows without user_id are legacy single-user records ────────────
-- They will not surface in adaptation queries (which filter on user_id IS NOT NULL).
-- No automatic backfill is possible because the original user identity was not
-- stored. To associate old rows with a user, run:
--
--   UPDATE public.quiz_results
--   SET user_id = '<your-user-uuid>'
--   WHERE user_id IS NULL;
--
-- For fresh installs with no existing data, this section can be ignored.
--
-- NOTE: The UNIQUE constraint above excludes NULL user_id values by default
-- (NULLs are not equal in SQL), so multiple legacy NULL-user_id rows for the
-- same chapter_id will coexist without violating the constraint.
