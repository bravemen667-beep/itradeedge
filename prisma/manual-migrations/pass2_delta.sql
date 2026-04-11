-- Pass 2 schema delta for iTradeEdge.
--
-- Pass 2 added two changes to prisma/schema.prisma but deliberately did
-- NOT run a Prisma migration (would need a live DB connection and could
-- lock in-flight queries). This file is the equivalent raw SQL — review
-- it, then apply it via either path:
--
--   A) Direct psql (recommended if you don't want Prisma to manage the
--      migration history yet):
--          psql "$DATABASE_URL" -f prisma/manual-migrations/pass2_delta.sql
--
--   B) Prisma db execute (uses the configured datasource, no migrations
--      directory required):
--          npx prisma db execute --file prisma/manual-migrations/pass2_delta.sql
--
--   C) Let Prisma reconcile from the schema (creates a real migration in
--      prisma/migrations/ — best for ongoing schema management going
--      forward):
--          npx prisma migrate dev --name pass2_cascade_and_compound_index
--      Note: this will also pick up any prior schema drift, so review
--      what it generates before accepting.
--
-- All three paths are idempotent thanks to the `IF NOT EXISTS` /
-- `DROP CONSTRAINT IF EXISTS` guards.

BEGIN;

-- 1. Trade.strategyId now cascades on Strategy delete.
--    Previously the default RESTRICT blocked Strategy deletion any time
--    historical trades existed.
ALTER TABLE "Trade" DROP CONSTRAINT IF EXISTS "Trade_strategyId_fkey";

ALTER TABLE "Trade"
  ADD CONSTRAINT "Trade_strategyId_fkey"
  FOREIGN KEY ("strategyId")
  REFERENCES "Strategy"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 2. Compound index for the dashboard hot path: open trades per strategy
--    ordered by entry time. Single-column indexes existed but Postgres
--    can't combine them efficiently for this access pattern.
CREATE INDEX IF NOT EXISTS "Trade_strategyId_status_entryTime_idx"
  ON "Trade" ("strategyId", "status", "entryTime");

COMMIT;
