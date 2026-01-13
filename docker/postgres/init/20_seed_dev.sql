-- Deterministic dev seed for local auth bypass mode
-- Keep IDs in sync with apps/api + apps/dashboard .env examples.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = '11111111-1111-1111-1111-111111111111') THEN
    INSERT INTO auth.users (id, email, raw_user_meta_data)
    VALUES (
      '11111111-1111-1111-1111-111111111111',
      'dev@midday.local',
      '{"email":"dev@midday.local","full_name":"Local Dev"}'::jsonb
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM teams WHERE id = '22222222-2222-2222-2222-222222222222') THEN
    INSERT INTO teams (id, name, email)
    VALUES ('22222222-2222-2222-2222-222222222222', 'Local Dev Team', 'dev@midday.local');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = '11111111-1111-1111-1111-111111111111') THEN
    INSERT INTO users (id, email, full_name, team_id)
    VALUES (
      '11111111-1111-1111-1111-111111111111',
      'dev@midday.local',
      'Local Dev',
      '22222222-2222-2222-2222-222222222222'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users_on_team
    WHERE user_id = '11111111-1111-1111-1111-111111111111'
      AND team_id = '22222222-2222-2222-2222-222222222222'
  ) THEN
    INSERT INTO users_on_team (id, user_id, team_id, role)
    VALUES (
      gen_random_uuid(),
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      'owner'
    );
  END IF;
END $$;

