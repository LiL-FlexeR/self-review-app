BEGIN;

ALTER TABLE "job_runs" ADD COLUMN "trigger" TEXT NOT NULL DEFAULT 'manual';

-- The old automatic-review parent and source represent the same sync.
-- Reject inconsistent legacy data instead of silently discarding its linkage.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM "job_runs"
        WHERE "parent_sync_run_id" IS NOT NULL
          AND ("type" <> 'review' OR "source_sync_run_id" IS DISTINCT FROM "parent_sync_run_id")
    ) THEN
        RAISE EXCEPTION 'Automatic review parent must match its source sync before migration';
    END IF;
END;
$$;

UPDATE "job_runs" SET "trigger" = 'automatic' WHERE "parent_sync_run_id" IS NOT NULL;

DROP INDEX "job_runs_parent_sync_run_id_key";
ALTER TABLE "job_runs" DROP CONSTRAINT "job_runs_parent_sync_run_id_fkey";
ALTER TABLE "job_runs" DROP COLUMN "parent_sync_run_id";

-- Public commands are manual; only review continuation is automatic in the MVP.
-- The existing review_requires_source constraint prevents a missing source.
ALTER TABLE "job_runs" ADD CONSTRAINT "job_trigger"
    CHECK ("trigger" = 'manual' OR ("trigger" = 'automatic' AND "type" = 'review'));

-- Preserve manual report history while deduplicating automatic continuation
-- across all states, including completed and failed review runs.
CREATE UNIQUE INDEX "job_runs_automatic_review_source_key"
    ON "job_runs" ("source_sync_run_id")
    WHERE "type" = 'review' AND "trigger" = 'automatic';

COMMIT;
