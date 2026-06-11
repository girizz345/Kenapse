-- ============================================================
-- KENAPSE — Complete Database Schema
-- Paste this entire file into Supabase SQL Editor and run it.
-- ============================================================


-- ── 1. STUDY MATERIALS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.study_materials (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     TEXT NOT NULL,
    file_url    TEXT NOT NULL,
    file_name   TEXT NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.study_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own materials"
    ON public.study_materials FOR SELECT
    USING (true);

CREATE POLICY "Users can insert own materials"
    ON public.study_materials FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can delete own materials"
    ON public.study_materials FOR DELETE
    USING (true);


-- ── 2. CHAPTERS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chapters (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID NOT NULL REFERENCES public.study_materials(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    objective   TEXT,
    topics      JSONB DEFAULT '[]'::jsonb,
    order_index INTEGER NOT NULL,
    status      TEXT NOT NULL DEFAULT 'locked',   -- locked | active | completed
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read chapters"
    ON public.chapters FOR SELECT
    USING (true);

CREATE POLICY "Anyone can insert chapters"
    ON public.chapters FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Anyone can update chapters"
    ON public.chapters FOR UPDATE
    USING (true);

CREATE POLICY "Anyone can delete chapters"
    ON public.chapters FOR DELETE
    USING (true);


-- ── 3. QUIZZES ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quizzes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id  UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
    questions   JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read quizzes"
    ON public.quizzes FOR SELECT
    USING (true);

CREATE POLICY "Anyone can insert quizzes"
    ON public.quizzes FOR INSERT
    WITH CHECK (true);


-- ── 4. QUIZ RESULTS (feedback / score history) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.quiz_results (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id                UUID REFERENCES public.chapters(id) ON DELETE CASCADE,
    score                     INTEGER NOT NULL,
    attempts                  INTEGER NOT NULL DEFAULT 1,
    difficulty_recommendation TEXT,
    created_at                TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert quiz results"
    ON public.quiz_results FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Anyone can read quiz results"
    ON public.quiz_results FOR SELECT
    USING (true);


-- ── 5. PROFILES (avatar + role) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL DEFAULT 'user',
    avatar_url  TEXT,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helper: check if the calling user is an admin (avoids infinite recursion in RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
    ON public.profiles FOR UPDATE
    USING (public.is_admin());


-- ── 6. AUTO-CREATE PROFILE ON SIGNUP ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ── 7. STORAGE BUCKETS ───────────────────────────────────────────────────────
-- "materials" bucket — stores uploaded PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('materials', 'materials', true)
ON CONFLICT (id) DO NOTHING;

-- "profiles" bucket — stores user avatar images
INSERT INTO storage.buckets (id, name, public)
VALUES ('profiles', 'profiles', true)
ON CONFLICT (id) DO NOTHING;


-- ── 8. STORAGE RLS POLICIES ──────────────────────────────────────────────────

-- Materials bucket: authenticated users can upload, everyone can read
CREATE POLICY "Authenticated users can upload materials"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'materials' AND auth.role() = 'authenticated');

CREATE POLICY "Materials are publicly readable"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'materials');

CREATE POLICY "Users can delete own materials"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'materials' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Profiles bucket: users can upload/update their own avatar, everyone can read
CREATE POLICY "Users can upload own avatar"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'profiles'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can update own avatar"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'profiles'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Avatars are publicly readable"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'profiles');
