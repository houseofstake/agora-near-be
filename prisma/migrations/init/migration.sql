-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "fastnear";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "web2";

-- CreateTable
CREATE TABLE "web2"."delegate_statements" (
    "address" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "topIssues" JSONB,
    "agreeCodeConduct" BOOLEAN NOT NULL,
    "twitter" TEXT,
    "discord" TEXT,
    "email" TEXT,
    "warpcast" TEXT,
    "endorsed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "delegate_statements_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "web2"."cache" (
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "cache_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "fastnear"."blocks" (
    "height" BIGINT NOT NULL,
    "hash" TEXT NOT NULL,
    "prev_hash" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "timestamp" TIMESTAMP(6) NOT NULL,
    "gas_price" TEXT NOT NULL,
    "total_supply" TEXT NOT NULL,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("height")
);

-- CreateTable
CREATE TABLE "fastnear"."cursors" (
    "id" TEXT NOT NULL,
    "cursor" TEXT,
    "block_num" BIGINT,
    "block_id" TEXT,

    CONSTRAINT "cursor_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fastnear"."execution_outcomes" (
    "receipt_id" TEXT NOT NULL,
    "block_height" BIGINT NOT NULL,
    "block_hash" TEXT NOT NULL,
    "chunk_hash" TEXT NOT NULL,
    "shard_id" TEXT NOT NULL,
    "gas_burnt" BIGINT NOT NULL,
    "gas_used" DOUBLE PRECISION NOT NULL,
    "tokens_burnt" DOUBLE PRECISION NOT NULL,
    "executor_account_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "outcome_receipt_ids" TEXT[],
    "executed_in_block_hash" TEXT NOT NULL,
    "logs" TEXT[],
    "results_json" JSON,
    "block_timestamp" TIMESTAMP(6),

    CONSTRAINT "execution_outcomes_pkey" PRIMARY KEY ("receipt_id")
);

-- CreateTable
CREATE TABLE "fastnear"."receipt_actions" (
    "id" TEXT NOT NULL,
    "block_height" BIGINT NOT NULL,
    "receipt_id" TEXT NOT NULL,
    "signer_account_id" TEXT NOT NULL,
    "signer_public_key" TEXT NOT NULL,
    "gas_price" TEXT NOT NULL,
    "action_kind" TEXT NOT NULL,
    "predecessor_id" TEXT NOT NULL,
    "receiver_id" TEXT NOT NULL,
    "block_hash" TEXT NOT NULL,
    "chunk_hash" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "method_name" TEXT NOT NULL,
    "gas" BIGINT NOT NULL,
    "deposit" TEXT NOT NULL,
    "args_base64" TEXT NOT NULL,
    "args_json" JSON,
    "action_index" INTEGER NOT NULL,
    "block_timestamp" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "receipt_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_delegate_statements_email" ON "web2"."delegate_statements"("email");

-- CreateIndex
CREATE INDEX "idx_cache_expires_at" ON "web2"."cache"("expires_at");