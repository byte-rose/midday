-- Minimal local DB bootstrap for Midday (no hosted Supabase required)

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Supabase-style ID helpers referenced by the existing schema defaults
CREATE OR REPLACE FUNCTION nanoid(size int DEFAULT 21) RETURNS text
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  alphabet text := '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  bytes bytea := gen_random_bytes(size);
  output text := '';
  i int;
  idx int;
BEGIN
  FOR i IN 0..size - 1 LOOP
    idx := (get_byte(bytes, i) % length(alphabet)) + 1;
    output := output || substr(alphabet, idx, 1);
  END LOOP;

  RETURN output;
END
$$;

CREATE OR REPLACE FUNCTION generate_inbox(size int DEFAULT 10) RETURNS text
LANGUAGE sql
VOLATILE
AS $$
  SELECT nanoid(size)
$$;

-- Helpers for generated search columns
CREATE OR REPLACE FUNCTION extract_product_names(products json) RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  names text;
BEGIN
  IF products IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT string_agg(NULLIF(trim(elem ->> 'name'), ''), ' ')
    INTO names
  FROM json_array_elements(products) AS elem;

  RETURN names;
EXCEPTION
  WHEN others THEN
    -- Non-array JSON or unexpected structure
    RETURN NULL;
END
$$;

CREATE OR REPLACE FUNCTION generate_inbox_fts(display_name text, product_names text) RETURNS tsvector
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT to_tsvector(
    'english'::regconfig,
    trim(coalesce(display_name, '') || ' ' || coalesce(product_names, ''))
  )
$$;

DO $$
BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE ROLE service_role NOLOGIN BYPASSRLS;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS private;

-- Supabase-compat helpers used by RLS policies in the existing schema
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

-- Used by many RLS policies; implemented with dynamic SQL so it can be created
-- before the referenced tables exist.
CREATE OR REPLACE FUNCTION private.get_teams_for_authenticated_user() RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY EXECUTE
    'select team_id from users_on_team where user_id = auth.uid()';
END
$$;

-- Minimal auth.users table to satisfy FK from public.users -> auth.users
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb
);
