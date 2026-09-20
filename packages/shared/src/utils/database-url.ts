/** Prevent node-postgres from falling back to a local database when config is missing. */
export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required for database access');
  return url;
}
