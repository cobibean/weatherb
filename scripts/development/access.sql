-- Server-side Prisma only. Apply after migrations as the migration owner.
-- This file intentionally grants nothing to Supabase browser/Data API roles.
BEGIN;
DO $$
DECLARE table_name text; api_role text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'SystemConfig','City','Market','TestRun','MagicLink','Suggestion','Vote','AdminLog',
    'AdminSession','game_sessions','receipts','statements','BotWallet','BotBet','BotFunding','BotError',
    'WorkerRun','WorkerLease','_prisma_migrations'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', table_name);
    FOREACH api_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT FROM pg_roles WHERE rolname = api_role) THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', table_name, api_role);
      END IF;
    END LOOP;
  END LOOP;
  FOREACH table_name IN ARRAY ARRAY['SystemConfig','City','Market','AdminLog','AdminSession','WorkerRun','WorkerLease'] LOOP
    FOREACH api_role IN ARRAY ARRAY['weatherb_app','weatherb_worker'] LOOP
      IF EXISTS (SELECT FROM pg_roles WHERE rolname = api_role) THEN
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO %I', table_name, api_role);
        IF NOT EXISTS (SELECT FROM pg_policies WHERE schemaname='public' AND tablename=table_name AND policyname='weatherb_server_' || api_role) THEN
          EXECUTE format('CREATE POLICY %I ON public.%I TO %I USING (true) WITH CHECK (true)', 'weatherb_server_' || api_role, table_name, api_role);
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END $$;
GRANT USAGE ON SCHEMA public TO weatherb_app;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'weatherb_worker') THEN
    GRANT USAGE ON SCHEMA public TO weatherb_worker;
  END IF;
END $$;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
COMMIT;
