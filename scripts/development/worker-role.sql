-- Run once on the hosted Neon project with its administrative role, then set the password out of band:
--   ALTER ROLE weatherb_worker LOGIN PASSWORD '<generated>';
-- Then re-run `npm run arc:hosted -- migrate` so access.sql grants the tables and policies.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='weatherb_worker') THEN
    CREATE ROLE weatherb_worker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO weatherb_worker', current_database());
END $$;
GRANT USAGE ON SCHEMA public TO weatherb_worker;
