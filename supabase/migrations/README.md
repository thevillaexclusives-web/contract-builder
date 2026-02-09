# Supabase Migrations

This directory contains SQL migration files for the contract editor database.

## Migration Files

### `mark-legacy-templates.sql`
Marks all existing templates as legacy by:
- Setting `deleted_at` timestamp (so they don't appear in the new app)
- Adding `legacy: true` flag to the `variables` JSONB column
- Adding `marked_legacy_at` timestamp to track when they were marked

**When to run:** Run this migration once when migrating from the legacy app to the new Next.js app.

**Safety:** This migration is idempotent - safe to run multiple times. It only updates templates that aren't already marked as legacy.

## Running Migrations

### Option 1: Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the migration SQL
4. Run the query

### Option 2: Supabase CLI
```bash
# If you have Supabase CLI installed
supabase db push
```

### Option 3: Direct SQL Execution
Connect to your database and run the SQL file directly.

## Verification

After running the migration, you can verify it worked by running:

```sql
SELECT 
    COUNT(*) as total_templates,
    COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as legacy_templates,
    COUNT(*) FILTER (WHERE deleted_at IS NULL) as active_templates
FROM public.contract_templates;
```

This will show you:
- Total templates
- How many were marked as legacy
- How many remain active (should be 0 if all were legacy)
