-- Create users table for storing Auth0 user data
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  auth0_id TEXT UNIQUE,
  selected_skills TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read/write users (since we're using Auth0 for auth, not Supabase auth)
-- In production, you'd want more restrictive policies
CREATE POLICY "Allow public read access" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.users FOR UPDATE USING (true);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users(email);
