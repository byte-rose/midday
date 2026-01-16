-- Patch schema drift between the introspected SQL snapshot and current schema.
-- Keep idempotent so local dev can restart safely.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_type') THEN
    CREATE TYPE public.activity_type AS ENUM (
      'transactions_enriched',
      'transactions_created',
      'invoice_paid',
      'inbox_new',
      'inbox_auto_matched',
      'inbox_needs_review',
      'inbox_cross_currency_matched',
      'invoice_overdue',
      'invoice_sent',
      'inbox_match_confirmed',
      'document_uploaded',
      'document_processed',
      'invoice_duplicated',
      'invoice_scheduled',
      'invoice_reminder_sent',
      'invoice_cancelled',
      'invoice_created',
      'draft_invoice_created',
      'tracker_entry_created',
      'tracker_project_created',
      'transactions_categorized',
      'transactions_assigned',
      'transaction_attachment_created',
      'transaction_category_created',
      'transactions_exported',
      'customer_created'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_source') THEN
    CREATE TYPE public.activity_source AS ENUM ('system', 'user');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_status') THEN
    CREATE TYPE public.activity_status AS ENUM ('unread', 'read', 'archived');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'accounting_provider') THEN
    CREATE TYPE public.accounting_provider AS ENUM ('xero', 'quickbooks', 'fortnox');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'accounting_sync_status') THEN
    CREATE TYPE public.accounting_sync_status AS ENUM ('synced', 'failed', 'pending', 'partial');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'accounting_sync_type') THEN
    CREATE TYPE public.accounting_sync_type AS ENUM ('auto', 'manual');
  END IF;
END $$;

ALTER TYPE "public"."transactionStatus" ADD VALUE IF NOT EXISTS 'exported';

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS tax_rate numeric,
  ADD COLUMN IF NOT EXISTS tax_amount numeric,
  ADD COLUMN IF NOT EXISTS tax_type text,
  ADD COLUMN IF NOT EXISTS counterparty_name text,
  ADD COLUMN IF NOT EXISTS merchant_name text,
  ADD COLUMN IF NOT EXISTS enrichment_completed boolean DEFAULT false;

ALTER TABLE public.transaction_categories
  ADD COLUMN IF NOT EXISTS tax_rate numeric,
  ADD COLUMN IF NOT EXISTS tax_type text,
  ADD COLUMN IF NOT EXISTS tax_reporting_code text,
  ADD COLUMN IF NOT EXISTS excluded boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_id uuid;

CREATE TABLE IF NOT EXISTS public.invoice_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  team_id uuid NOT NULL,
  created_by uuid,
  name text NOT NULL,
  description text,
  price numeric,
  currency text,
  unit text,
  is_active boolean DEFAULT true NOT NULL,
  usage_count integer DEFAULT 0 NOT NULL,
  last_used_at timestamp with time zone,
  fts tsvector GENERATED ALWAYS AS (
    to_tsvector(
      'english',
      ((COALESCE(name, ''::text) || ' '::text) || COALESCE(description, ''::text))
    )
  ) STORED NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_products_team_id_fkey') THEN
    ALTER TABLE public.invoice_products
      ADD CONSTRAINT invoice_products_team_id_fkey
      FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE cascade;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_products_created_by_fkey') THEN
    ALTER TABLE public.invoice_products
      ADD CONSTRAINT invoice_products_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE set null;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS invoice_products_team_id_idx ON public.invoice_products (team_id);
CREATE INDEX IF NOT EXISTS invoice_products_created_by_idx ON public.invoice_products (created_by);
CREATE INDEX IF NOT EXISTS invoice_products_fts_idx ON public.invoice_products USING gin (fts);
CREATE INDEX IF NOT EXISTS invoice_products_name_idx ON public.invoice_products (name);
CREATE INDEX IF NOT EXISTS invoice_products_usage_count_idx ON public.invoice_products (usage_count);
CREATE INDEX IF NOT EXISTS invoice_products_last_used_at_idx ON public.invoice_products (last_used_at);
CREATE INDEX IF NOT EXISTS invoice_products_team_active_idx ON public.invoice_products (team_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS invoice_products_team_name_currency_price_unique
  ON public.invoice_products (team_id, name, currency, price);

CREATE TABLE IF NOT EXISTS public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  team_id uuid NOT NULL,
  user_id uuid,
  type public.activity_type NOT NULL,
  priority smallint DEFAULT 5,
  group_id uuid,
  source public.activity_source NOT NULL,
  metadata jsonb NOT NULL,
  status public.activity_status DEFAULT 'unread' NOT NULL,
  last_used_at timestamp with time zone
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activities_team_id_fkey') THEN
    ALTER TABLE public.activities
      ADD CONSTRAINT activities_team_id_fkey
      FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE cascade;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activities_user_id_fkey') THEN
    ALTER TABLE public.activities
      ADD CONSTRAINT activities_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE set null;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS activities_notifications_idx
  ON public.activities (team_id, priority, status, created_at DESC);
CREATE INDEX IF NOT EXISTS activities_insights_idx
  ON public.activities (team_id, type, source, created_at DESC);
CREATE INDEX IF NOT EXISTS activities_metadata_gin_idx
  ON public.activities USING gin (metadata);
CREATE INDEX IF NOT EXISTS activities_group_id_idx ON public.activities (group_id);
CREATE INDEX IF NOT EXISTS activities_insights_group_idx
  ON public.activities (team_id, group_id, type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.oauth_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  overview text,
  developer_name text,
  logo_url text,
  website text,
  install_url text,
  screenshots text[] DEFAULT '{}'::text[],
  redirect_uris text[] NOT NULL,
  client_id text NOT NULL,
  client_secret text NOT NULL,
  scopes text[] DEFAULT '{}'::text[] NOT NULL,
  team_id uuid NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  is_public boolean DEFAULT false,
  active boolean DEFAULT true,
  status text DEFAULT 'draft'
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oauth_applications_team_id_fkey') THEN
    ALTER TABLE public.oauth_applications
      ADD CONSTRAINT oauth_applications_team_id_fkey
      FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE cascade;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oauth_applications_created_by_fkey') THEN
    ALTER TABLE public.oauth_applications
      ADD CONSTRAINT oauth_applications_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE cascade;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS oauth_applications_slug_key ON public.oauth_applications (slug);
CREATE UNIQUE INDEX IF NOT EXISTS oauth_applications_client_id_key ON public.oauth_applications (client_id);
CREATE INDEX IF NOT EXISTS oauth_applications_team_id_idx ON public.oauth_applications (team_id);
CREATE INDEX IF NOT EXISTS oauth_applications_client_id_idx ON public.oauth_applications (client_id);
CREATE INDEX IF NOT EXISTS oauth_applications_slug_idx ON public.oauth_applications (slug);

CREATE TABLE IF NOT EXISTS public.oauth_authorization_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  code text NOT NULL,
  application_id uuid NOT NULL,
  user_id uuid NOT NULL,
  team_id uuid NOT NULL,
  scopes text[] NOT NULL,
  redirect_uri text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  used boolean DEFAULT false,
  code_challenge text,
  code_challenge_method text
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oauth_authorization_codes_application_id_fkey') THEN
    ALTER TABLE public.oauth_authorization_codes
      ADD CONSTRAINT oauth_authorization_codes_application_id_fkey
      FOREIGN KEY (application_id) REFERENCES public.oauth_applications(id) ON DELETE cascade;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oauth_authorization_codes_user_id_fkey') THEN
    ALTER TABLE public.oauth_authorization_codes
      ADD CONSTRAINT oauth_authorization_codes_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE cascade;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oauth_authorization_codes_team_id_fkey') THEN
    ALTER TABLE public.oauth_authorization_codes
      ADD CONSTRAINT oauth_authorization_codes_team_id_fkey
      FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE cascade;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS oauth_authorization_codes_code_key ON public.oauth_authorization_codes (code);
CREATE INDEX IF NOT EXISTS oauth_authorization_codes_code_idx ON public.oauth_authorization_codes (code);
CREATE INDEX IF NOT EXISTS oauth_authorization_codes_application_id_idx ON public.oauth_authorization_codes (application_id);
CREATE INDEX IF NOT EXISTS oauth_authorization_codes_user_id_idx ON public.oauth_authorization_codes (user_id);

CREATE TABLE IF NOT EXISTS public.oauth_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  token text NOT NULL,
  refresh_token text,
  application_id uuid NOT NULL,
  user_id uuid NOT NULL,
  team_id uuid NOT NULL,
  scopes text[] NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  refresh_token_expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  last_used_at timestamp with time zone,
  revoked boolean DEFAULT false,
  revoked_at timestamp with time zone
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oauth_access_tokens_application_id_fkey') THEN
    ALTER TABLE public.oauth_access_tokens
      ADD CONSTRAINT oauth_access_tokens_application_id_fkey
      FOREIGN KEY (application_id) REFERENCES public.oauth_applications(id) ON DELETE cascade;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oauth_access_tokens_user_id_fkey') THEN
    ALTER TABLE public.oauth_access_tokens
      ADD CONSTRAINT oauth_access_tokens_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE cascade;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oauth_access_tokens_team_id_fkey') THEN
    ALTER TABLE public.oauth_access_tokens
      ADD CONSTRAINT oauth_access_tokens_team_id_fkey
      FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE cascade;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS oauth_access_tokens_token_key ON public.oauth_access_tokens (token);
CREATE UNIQUE INDEX IF NOT EXISTS oauth_access_tokens_refresh_token_key ON public.oauth_access_tokens (refresh_token);
CREATE INDEX IF NOT EXISTS oauth_access_tokens_token_idx ON public.oauth_access_tokens (token);
CREATE INDEX IF NOT EXISTS oauth_access_tokens_refresh_token_idx ON public.oauth_access_tokens (refresh_token);
CREATE INDEX IF NOT EXISTS oauth_access_tokens_application_id_idx ON public.oauth_access_tokens (application_id);
CREATE INDEX IF NOT EXISTS oauth_access_tokens_user_id_idx ON public.oauth_access_tokens (user_id);

CREATE TABLE IF NOT EXISTS public.accounting_sync_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  transaction_id uuid NOT NULL,
  team_id uuid NOT NULL,
  provider public.accounting_provider NOT NULL,
  provider_tenant_id text NOT NULL,
  provider_transaction_id text,
  synced_attachment_mapping jsonb DEFAULT '{}'::jsonb NOT NULL,
  synced_at timestamp with time zone DEFAULT now() NOT NULL,
  sync_type public.accounting_sync_type,
  status public.accounting_sync_status DEFAULT 'synced' NOT NULL,
  error_message text,
  error_code text,
  provider_entity_type text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounting_sync_records_transaction_id_fkey') THEN
    ALTER TABLE public.accounting_sync_records
      ADD CONSTRAINT accounting_sync_records_transaction_id_fkey
      FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE cascade;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounting_sync_records_team_id_fkey') THEN
    ALTER TABLE public.accounting_sync_records
      ADD CONSTRAINT accounting_sync_records_team_id_fkey
      FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE cascade;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_accounting_sync_transaction
  ON public.accounting_sync_records (transaction_id);
CREATE INDEX IF NOT EXISTS idx_accounting_sync_team_provider
  ON public.accounting_sync_records (team_id, provider);
CREATE INDEX IF NOT EXISTS idx_accounting_sync_status
  ON public.accounting_sync_records (team_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS accounting_sync_records_transaction_provider_key
  ON public.accounting_sync_records (transaction_id, provider);

CREATE OR REPLACE FUNCTION public.get_bank_account_currencies(team_id uuid)
RETURNS TABLE (currency text)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT ba.currency
  FROM public.bank_accounts ba
  WHERE ba.team_id = $1 AND ba.currency IS NOT NULL
  ORDER BY ba.currency
$$;

CREATE OR REPLACE FUNCTION public.get_team_bank_accounts_balances(team_id uuid)
RETURNS TABLE (
  id uuid,
  currency text,
  balance numeric,
  name text,
  logo_url text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    ba.id,
    ba.currency,
    ba.balance,
    ba.name,
    bc.logo_url
  FROM public.bank_accounts ba
  LEFT JOIN public.bank_connections bc ON bc.id = ba.bank_connection_id
  WHERE ba.team_id = $1
$$;
