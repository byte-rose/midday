-- Minimal OSS function stubs for local Postgres.
-- Keep signatures compatible with existing queries.

CREATE OR REPLACE FUNCTION public.get_next_invoice_number(p_team_id uuid)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT (COALESCE(
    MAX(NULLIF(regexp_replace(invoice_number, '\D', '', 'g'), '')::int),
    0
  ) + 1)::text
  FROM public.invoices
  WHERE team_id = p_team_id
$$;

CREATE OR REPLACE FUNCTION public.global_search(
  search_term text,
  team_id uuid,
  language text,
  limit_count integer,
  items_per_table_limit integer,
  relevance_threshold numeric
)
RETURNS TABLE (
  id uuid,
  type text,
  title text,
  relevance double precision,
  created_at timestamptz,
  data jsonb
)
LANGUAGE sql
STABLE
AS $$
  SELECT NULL::uuid, NULL::text, NULL::text, NULL::double precision, NULL::timestamptz, NULL::jsonb
  WHERE false
$$;

CREATE OR REPLACE FUNCTION public.global_semantic_search(
  team_id uuid,
  search_term text,
  start_date text,
  end_date text,
  types text[],
  amount numeric,
  amount_min numeric,
  amount_max numeric,
  status text,
  currency text,
  language text,
  due_date_start text,
  due_date_end text,
  max_results integer,
  items_per_table_limit integer
)
RETURNS TABLE (
  id uuid,
  type text,
  title text,
  relevance double precision,
  created_at timestamptz,
  data jsonb
)
LANGUAGE sql
STABLE
AS $$
  SELECT NULL::uuid, NULL::text, NULL::text, NULL::double precision, NULL::timestamptz, NULL::jsonb
  WHERE false
$$;

CREATE OR REPLACE FUNCTION public.total_duration(p tracker_projects)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(duration), 0)
  FROM public.tracker_entries
  WHERE project_id = p.id
$$;
