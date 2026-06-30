-- Add slug column to City table
-- This is a 3-step migration to handle existing data

-- Step 1: Add slug column as nullable
ALTER TABLE "City" ADD COLUMN "slug" TEXT;

-- Step 2: Populate slugs for existing cities
-- Convert name to lowercase and replace spaces with hyphens
UPDATE "City" SET "slug" = LOWER(REPLACE(REPLACE(name, ' ', '-'), '''', ''));

-- Step 3: Make slug required and add unique constraint
ALTER TABLE "City" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "City_slug_key" ON "City"("slug");
