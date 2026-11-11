-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "email_verified_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "consumed_at" TIMESTAMPTZ,
    "replaced_by_id" UUID,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connections" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "encrypted_credentials" TEXT,
    "credential_version" INTEGER NOT NULL DEFAULT 1,
    "source_user_id" TEXT NOT NULL,
    "source_user_name" TEXT NOT NULL,
    "source_base_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_projects" (
    "id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "breadcrumb" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "source_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_runs" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "selection" JSONB NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "subject_source_user_id" TEXT NOT NULL,
    "base_sync_run_id" UUID,
    "source_sync_run_id" UUID,
    "parent_sync_run_id" UUID,
    "generate_review" BOOLEAN NOT NULL DEFAULT false,
    "current_review_report_id" UUID,
    "idempotency_key" TEXT NOT NULL,
    "request_fingerprint" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'queued',
    "stage" TEXT NOT NULL DEFAULT 'queued',
    "version" INTEGER NOT NULL DEFAULT 1,
    "counts" JSONB NOT NULL DEFAULT '{}',
    "import_complete" BOOLEAN NOT NULL DEFAULT false,
    "analysis_complete" BOOLEAN NOT NULL DEFAULT false,
    "coverage" JSONB NOT NULL DEFAULT '{}',
    "heartbeat_at" TIMESTAMPTZ,
    "unit_deadline_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ,
    "finished_at" TIMESTAMPTZ,
    "error" JSONB,
    "usage" JSONB NOT NULL DEFAULT '{}',
    "trace" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_snapshots" (
    "id" UUID NOT NULL,
    "sync_run_id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "assignees" JSONB NOT NULL DEFAULT '[]',
    "source_created_at" TIMESTAMPTZ NOT NULL,
    "source_updated_at" TIMESTAMPTZ,
    "retrieved_at" TIMESTAMPTZ NOT NULL,
    "safe_url" TEXT,
    "detail_status" TEXT NOT NULL,
    "refresh_status" TEXT NOT NULL,
    "comment_read_state" TEXT NOT NULL DEFAULT 'not_read',
    "comment_read_at" TIMESTAMPTZ,
    "comments_truncated" BOOLEAN NOT NULL DEFAULT false,
    "comment_error_code" TEXT,
    "copied_from_snapshot_id" UUID,

    CONSTRAINT "task_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_snapshots" (
    "id" UUID NOT NULL,
    "task_snapshot_id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "author" TEXT,
    "source_created_at" TIMESTAMPTZ,
    "retrieved_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "comment_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_batches" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "phase" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "ordinal" INTEGER NOT NULL,
    "input_ids" JSONB NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "coverage" JSONB NOT NULL DEFAULT '{}',
    "trace" JSONB NOT NULL DEFAULT '[]',
    "usage" JSONB NOT NULL DEFAULT '{}',
    "output" JSONB,

    CONSTRAINT "analysis_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_analyses" (
    "id" UUID NOT NULL,
    "sync_run_id" UUID NOT NULL,
    "findings" JSONB NOT NULL,
    "limitations" JSONB NOT NULL,

    CONSTRAINT "sync_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_reports" (
    "id" UUID NOT NULL,
    "review_run_id" UUID NOT NULL,
    "source_sync_run_id" UUID NOT NULL,
    "subject_source_user_id" TEXT NOT NULL,
    "draft" JSONB NOT NULL,
    "markdown" TEXT NOT NULL,
    "sources" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_attempts" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "attempt_no" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "provider_response_id" TEXT,
    "usage" JSONB,
    "usage_unknown" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");

-- CreateIndex
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_replaced_by_id_key" ON "refresh_tokens"("replaced_by_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_session_id_expires_at_idx" ON "refresh_tokens"("session_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_id_session_id_key" ON "refresh_tokens"("id", "session_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_replaced_by_id_session_id_key" ON "refresh_tokens"("replaced_by_id", "session_id");

-- CreateIndex
CREATE INDEX "connections_owner_id_idx" ON "connections"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "source_projects_connection_id_external_id_key" ON "source_projects"("connection_id", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_runs_parent_sync_run_id_key" ON "job_runs"("parent_sync_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_runs_current_review_report_id_key" ON "job_runs"("current_review_report_id");

-- CreateIndex
CREATE INDEX "job_runs_project_id_created_at_idx" ON "job_runs"("project_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "job_runs_owner_id_type_idempotency_key_key" ON "job_runs"("owner_id", "type", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "task_snapshots_sync_run_id_external_id_key" ON "task_snapshots"("sync_run_id", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "comment_snapshots_task_snapshot_id_external_id_key" ON "comment_snapshots"("task_snapshot_id", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "analysis_batches_run_id_phase_level_ordinal_key" ON "analysis_batches"("run_id", "phase", "level", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "analysis_batches_id_run_id_key" ON "analysis_batches"("id", "run_id");

-- CreateIndex
CREATE UNIQUE INDEX "sync_analyses_sync_run_id_key" ON "sync_analyses"("sync_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_reports_review_run_id_key" ON "review_reports"("review_run_id");

-- CreateIndex
CREATE INDEX "model_attempts_batch_id_idx" ON "model_attempts"("batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "model_attempts_run_id_attempt_no_key" ON "model_attempts"("run_id", "attempt_no");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_replaced_by_id_session_id_fkey" FOREIGN KEY ("replaced_by_id", "session_id") REFERENCES "refresh_tokens"("id", "session_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_projects" ADD CONSTRAINT "source_projects_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "source_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_base_sync_run_id_fkey" FOREIGN KEY ("base_sync_run_id") REFERENCES "job_runs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_source_sync_run_id_fkey" FOREIGN KEY ("source_sync_run_id") REFERENCES "job_runs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_parent_sync_run_id_fkey" FOREIGN KEY ("parent_sync_run_id") REFERENCES "job_runs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_current_review_report_id_fkey" FOREIGN KEY ("current_review_report_id") REFERENCES "review_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_snapshots" ADD CONSTRAINT "task_snapshots_sync_run_id_fkey" FOREIGN KEY ("sync_run_id") REFERENCES "job_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_snapshots" ADD CONSTRAINT "task_snapshots_copied_from_snapshot_id_fkey" FOREIGN KEY ("copied_from_snapshot_id") REFERENCES "task_snapshots"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "comment_snapshots" ADD CONSTRAINT "comment_snapshots_task_snapshot_id_fkey" FOREIGN KEY ("task_snapshot_id") REFERENCES "task_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_batches" ADD CONSTRAINT "analysis_batches_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "job_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_analyses" ADD CONSTRAINT "sync_analyses_sync_run_id_fkey" FOREIGN KEY ("sync_run_id") REFERENCES "job_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_review_run_id_fkey" FOREIGN KEY ("review_run_id") REFERENCES "job_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_source_sync_run_id_fkey" FOREIGN KEY ("source_sync_run_id") REFERENCES "job_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_attempts" ADD CONSTRAINT "model_attempts_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "job_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_attempts" ADD CONSTRAINT "model_attempts_batch_id_run_id_fkey" FOREIGN KEY ("batch_id", "run_id") REFERENCES "analysis_batches"("id", "run_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The fixture source does not consume a live provider slot. Invalid credentials
-- retain their slot until explicit connection deletion.
CREATE UNIQUE INDEX connections_live_provider_slot ON connections(owner_id, provider) WHERE mode = 'live';
CREATE UNIQUE INDEX job_runs_activity_slot ON job_runs(owner_id, project_id) WHERE state IN ('queued','running');
ALTER TABLE auth_sessions ADD CONSTRAINT session_deadline CHECK (expires_at > created_at);
ALTER TABLE refresh_tokens ADD CONSTRAINT token_deadline CHECK (expires_at > created_at);
ALTER TABLE refresh_tokens ADD CONSTRAINT consumed_successor CHECK (replaced_by_id IS NULL OR consumed_at IS NOT NULL);
ALTER TABLE job_runs ADD CONSTRAINT job_type CHECK (type IN ('sync','review'));
ALTER TABLE job_runs ADD CONSTRAINT job_state CHECK (state IN ('queued','running','succeeded','partial','failed'));
ALTER TABLE job_runs ADD CONSTRAINT review_requires_source CHECK (type <> 'review' OR source_sync_run_id IS NOT NULL);
ALTER TABLE model_attempts ADD CONSTRAINT positive_attempt CHECK (attempt_no > 0);
