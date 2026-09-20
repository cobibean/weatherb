-- Run once on the NEW development project with its administrative database role.
-- Set unique passwords out of band; never commit them. Runtime gets no DDL rights.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='weatherb_migrator') THEN
    CREATE ROLE weatherb_migrator NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='weatherb_app') THEN
    CREATE ROLE weatherb_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
  EXECUTE format('GRANT CONNECT, CREATE ON DATABASE %I TO weatherb_migrator', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO weatherb_app', current_database());
END $$;
GRANT USAGE, CREATE ON SCHEMA public TO weatherb_migrator;
GRANT USAGE ON SCHEMA public TO weatherb_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
