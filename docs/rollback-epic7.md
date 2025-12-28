# Rollback Plan for Epic 7 Database Changes

## Database Backup Note

**Environment:** Supabase PostgreSQL 17.6
**Backup Method:** Supabase provides automatic backups (Point-in-Time Recovery)

Local `pg_dump` backup was not possible due to version mismatch:
- Server version: 17.6
- Local pg_dump: 14.19

For manual backup/restore, use Supabase dashboard or upgrade local pg_dump to version 17+.

## If Migration Fails

### Option 1: Supabase Point-in-Time Recovery
1. Go to Supabase Dashboard → Database → Backups
2. Select point-in-time before migration (check git commit timestamp)
3. Restore to that point

### Option 2: Manual Rollback via Prisma
1. Delete migration files: `rm -rf apps/web/prisma/migrations/*_epic7_* apps/web/prisma/migrations/*_update_admin_*`
2. Restore schema.prisma: `git restore apps/web/prisma/schema.prisma`
3. Reset database to match old schema: `cd apps/web && npx prisma migrate reset`
4. Regenerate Prisma client: `npx prisma generate`

### Option 3: Manual SQL Rollback
If tables were created but need to be dropped:

```sql
-- Drop Epic 7 tables
DROP TABLE IF EXISTS "Vote" CASCADE;
DROP TABLE IF EXISTS "Suggestion" CASCADE;

-- Drop Epic 7 enums
DROP TYPE IF EXISTS "TimeWindow";
DROP TYPE IF EXISTS "SuggestionStatus";

-- Revert AdminLog changes (if applied)
ALTER TABLE "AdminLog" DROP CONSTRAINT IF EXISTS vote_count_non_negative;
-- ... (add other constraint drops as needed)
```

## If Migration Succeeds But Has Issues

1. Create down migration manually based on specific issue
2. Apply down migration: `cd apps/web && npx prisma migrate dev`
3. If severe: Use Option 1 (Supabase PITR) above

## Pre-Migration Checklist

- ✅ Database connection verified (Prisma can connect)
- ⚠️  Local backup not created (Supabase handles backups)
- ✅ Rollback plan documented
- ⏳ Git branch created (if desired for isolation)

## Post-Migration Verification

After migration:
1. Verify tables exist: `psql $DIRECT_URL -c "\dt"`
2. Verify indexes exist: `psql $DIRECT_URL -c "\d+ \"Suggestion\""`
3. Test basic queries work
4. Run application tests

## Emergency Contact

If issues occur:
- Supabase Support (for production database)
- Git history has pre-migration schema state
- All schema changes are version controlled
