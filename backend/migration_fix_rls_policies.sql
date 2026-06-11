-- ============================================================
-- KENAPSE — Fix RLS Policies
-- Run AFTER schema.sql and migration_add_adaptation_columns.sql
-- ============================================================
-- Replaces the open "USING (true)" policies with user-scoped ones.
-- The backend (service role key) bypasses RLS automatically.
-- These policies protect direct Supabase client calls from the frontend.
-- ============================================================


-- ── Helper: check ownership of a material ───────────────────
CREATE OR REPLACE FUNCTION public.owns_material(material_row_user_id TEXT)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT auth.uid()::text = material_row_user_id;
$$;


-- ── 1. STUDY MATERIALS ───────────────────────────────────────

DROP POLICY IF EXISTS "Users can read own materials" ON public.study_materials;
DROP POLICY IF EXISTS "Users can insert own materials" ON public.study_materials;
DROP POLICY IF EXISTS "Users can delete own materials" ON public.study_materials;

CREATE POLICY "Users can read own materials"
    ON public.study_materials FOR SELECT
    USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own materials"
    ON public.study_materials FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own materials"
    ON public.study_materials FOR DELETE
    USING (auth.uid()::text = user_id);

-- Admins can read all materials for the admin dashboard
CREATE POLICY "Admins can read all materials"
    ON public.study_materials FOR SELECT
    USING (public.is_admin());


-- ── 2. CHAPTERS ──────────────────────────────────────────────
-- Chapters belong to a study_material; ownership is inherited.

DROP POLICY IF EXISTS "Anyone can read chapters" ON public.chapters;
DROP POLICY IF EXISTS "Anyone can insert chapters" ON public.chapters;
DROP POLICY IF EXISTS "Anyone can update chapters" ON public.chapters;
DROP POLICY IF EXISTS "Anyone can delete chapters" ON public.chapters;

CREATE POLICY "Users can read own chapters"
    ON public.chapters FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.study_materials sm
            WHERE sm.id = chapters.material_id
              AND sm.user_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can insert own chapters"
    ON public.chapters FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.study_materials sm
            WHERE sm.id = chapters.material_id
              AND sm.user_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can update own chapters"
    ON public.chapters FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.study_materials sm
            WHERE sm.id = chapters.material_id
              AND sm.user_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can delete own chapters"
    ON public.chapters FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.study_materials sm
            WHERE sm.id = chapters.material_id
              AND sm.user_id = auth.uid()::text
        )
    );

CREATE POLICY "Admins can read all chapters"
    ON public.chapters FOR SELECT
    USING (public.is_admin());


-- ── 3. QUIZZES ───────────────────────────────────────────────
-- Quizzes belong to a chapter → material → user.

DROP POLICY IF EXISTS "Anyone can read quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Anyone can insert quizzes" ON public.quizzes;

CREATE POLICY "Users can read own quizzes"
    ON public.quizzes FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.chapters c
            JOIN public.study_materials sm ON sm.id = c.material_id
            WHERE c.id = quizzes.chapter_id
              AND sm.user_id = auth.uid()::text
        )
    );

CREATE POLICY "Users can insert own quizzes"
    ON public.quizzes FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.chapters c
            JOIN public.study_materials sm ON sm.id = c.material_id
            WHERE c.id = quizzes.chapter_id
              AND sm.user_id = auth.uid()::text
        )
    );

CREATE POLICY "Admins can read all quizzes"
    ON public.quizzes FOR SELECT
    USING (public.is_admin());


-- ── 4. QUIZ RESULTS ──────────────────────────────────────────
-- New rows have user_id populated. Old rows (NULL) remain readable
-- only by admins to avoid locking out historical data.

DROP POLICY IF EXISTS "Anyone can insert quiz results" ON public.quiz_results;
DROP POLICY IF EXISTS "Anyone can read quiz results" ON public.quiz_results;

CREATE POLICY "Users can insert own quiz results"
    ON public.quiz_results FOR INSERT
    WITH CHECK (
        user_id IS NULL OR auth.uid()::text = user_id
    );

CREATE POLICY "Users can read own quiz results"
    ON public.quiz_results FOR SELECT
    USING (
        auth.uid()::text = user_id
    );

CREATE POLICY "Users can update own quiz results"
    ON public.quiz_results FOR UPDATE
    USING (
        auth.uid()::text = user_id
    );

CREATE POLICY "Admins can read all quiz results"
    ON public.quiz_results FOR SELECT
    USING (public.is_admin());
