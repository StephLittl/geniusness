-- Backfill Users: stolowd, bob, sary
-- Run this in Supabase SQL Editor after creating auth users (see instructions below)

-- Option 1: If you've already created auth users via Supabase Dashboard or Admin API
-- Replace the UUIDs below with the actual user IDs from auth.users

-- First, get the user IDs from auth.users (run this query to see existing users):
-- SELECT id, email FROM auth.users;

-- Then insert into users table (replace the UUIDs with actual IDs):
INSERT INTO users (user_id, first_name, last_name, username, email)
VALUES
  -- Replace '00000000-0000-0000-0000-000000000001' with stolowd's auth.users.id
  ('00000000-0000-0000-0000-000000000001', 'Stolowd', NULL, 'stolowd', 'stolowd@example.com'),
  -- Replace '00000000-0000-0000-0000-000000000002' with bob's auth.users.id
  ('00000000-0000-0000-0000-000000000002', 'Bob', NULL, 'bob', 'bob@example.com'),
  -- Replace '00000000-0000-0000-0000-000000000003' with sary's auth.users.id
  ('00000000-0000-0000-0000-000000000003', 'Sary', NULL, 'sary', 'sary@example.com')
ON CONFLICT (username) DO UPDATE
SET 
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  email = EXCLUDED.email;

-- Option 2: Create auth users via SQL (requires service role access)
-- Note: This may not work depending on your Supabase setup. 
-- If it doesn't work, use the Supabase Dashboard or Admin API instead.

-- Create auth users (this might require special permissions)
-- Uncomment and modify if you have direct access to auth.users:

/*
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  confirmation_token,
  recovery_token
)
VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'stolowd@example.com',
    crypt('TempPassword123!', gen_salt('bf')), -- User should change this
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'bob@example.com',
    crypt('TempPassword123!', gen_salt('bf')), -- User should change this
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'sary@example.com',
    crypt('TempPassword123!', gen_salt('bf')), -- User should change this
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    '',
    ''
  );
*/

-- RECOMMENDED APPROACH: Use Supabase Admin API or Dashboard
-- 
-- Step 1: Create auth users using one of these methods:
--   A) Supabase Dashboard → Authentication → Add User (manual)
--   B) Use the Admin API (see script below)
--   C) Use the Supabase CLI
--
-- Step 2: After creating auth users, get their IDs:
SELECT id, email FROM auth.users WHERE email IN ('stolowd@example.com', 'bob@example.com', 'sary@example.com');
--
-- Step 3: Update the INSERT statement above with the actual UUIDs from Step 2
-- Step 4: Run the INSERT INTO users statement
