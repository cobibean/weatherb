-- Server-side Prisma only. Apply after migrations as the migration owner.
-- This file intentionally grants nothing to Supabase browser/Data API roles.
BEGIN;
DO $$
DECLARE table_name text; api_role text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'SystemConfig','City','Market','TestRun','MagicLink','Suggestion','Vote','AdminLog',
    'AdminSession','game_sessions','receipts','statements','BotWallet','BotBet','BotFunding','BotError',
    '_prisma_migrations'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', table_name);
    FOREACH api_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT FROM pg_roles WHERE rolname = api_role) THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', table_name, api_role);
      END IF;
    END LOOP;
  END LOOP;
  FOREACH table_name IN ARRAY ARRAY['SystemConfig','City','Market','AdminLog','AdminSession'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO weatherb_app', table_name);
    IF NOT EXISTS (SELECT FROM pg_policies WHERE schemaname='public' AND tablename=table_name AND policyname='weatherb_server') THEN
      EXECUTE format('CREATE POLICY weatherb_server ON public.%I TO weatherb_app USING (true) WITH CHECK (true)', table_name);
    END IF;
  END LOOP;
END $$;
GRANT USAGE ON SCHEMA public TO weatherb_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
COMMIT;
