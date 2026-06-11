-- ============================================================
-- KENAPSE — Complete Admin Fix Migration
-- Run this ONCE in Supabase SQL Editor → New query → Run
-- ============================================================

-- ── STEP 1: Add missing columns to profiles ──────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email      TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name       TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- ── STEP 2: Update signup trigger to auto-save email + name ──
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, email, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name  = COALESCE(EXCLUDED.name, public.profiles.name),
    role  = EXCLUDED.role;
  RETURN NEW;
END;
$$;

-- ── STEP 3: Back-fill email + name for ALL existing users ────
UPDATE public.profiles p
SET
  email = u.email,
  name  = COALESCE(
            u.raw_user_meta_data->>'name',
            split_part(u.email, '@', 1)
          )
FROM auth.users u
WHERE p.id = u.id;

-- ── STEP 4: Sync role from user_metadata → profiles ──────────
-- This is the CRITICAL step — the is_admin() SQL function checks
-- profiles.role, not user_metadata. Without this, admins can't
-- see all users in the dashboard.
UPDATE public.profiles p
SET role = u.raw_user_meta_data->>'role'
FROM auth.users u
WHERE p.id = u.id
  AND u.raw_user_meta_data->>'role' IS NOT NULL
  AND u.raw_user_meta_data->>'role' IN ('admin', 'user');

-- ── STEP 5: Fix the is_admin() helper function ────────────────
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

-- ── STEP 6: Fix RLS so admins can read ALL profiles ───────────
DROP POLICY IF EXISTS "Users can read own profile"  ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;

CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_admin());

-- ── STEP 7: Verify — run to confirm it worked ─────────────────
SELECT
  p.id,
  p.email,
  p.name,
  p.role,
  p.created_at,
  u.raw_user_meta_data->>'role' AS meta_role
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
ORDER BY p.created_at DESC;
