-- CreateTable
CREATE TABLE "blocks" (
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
CREATE TABLE "chunks" (
    "height" BIGINT NOT NULL,
    "chunk_hash" TEXT NOT NULL,
    "prev_block_hash" TEXT NOT NULL,
    "outcome_root" TEXT NOT NULL,
    "prev_state_root" TEXT NOT NULL,
    "encoded_merkle_root" TEXT NOT NULL,
    "encoded_length" BIGINT NOT NULL,
    "height_created" BIGINT NOT NULL,
    "height_included" BIGINT NOT NULL,
    "shard_id" BIGINT NOT NULL,
    "gas_used" BIGINT NOT NULL,
    "gas_limit" BIGINT NOT NULL,
    "validator_reward" TEXT NOT NULL,
    "balance_burnt" TEXT NOT NULL,
    "outgoing_receipts_root" TEXT NOT NULL,
    "tx_root" TEXT NOT NULL,
    "author" TEXT NOT NULL,

    CONSTRAINT "chunks_pkey" PRIMARY KEY ("chunk_hash")
);

-- CreateTable
CREATE TABLE "cursors" (
    "id" TEXT NOT NULL,
    "cursor" TEXT,
    "block_num" BIGINT,
    "block_id" TEXT,

    CONSTRAINT "cursor_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_actions" (
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
    "action_index" INTEGER NOT NULL,
    "block_timestamp" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "receipt_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "height" BIGINT NOT NULL,
    "block_hash" TEXT NOT NULL,
    "chunk_hash" TEXT NOT NULL,
    "receipt_id" TEXT NOT NULL,
    "predecessor_id" TEXT NOT NULL,
    "receiver_id" TEXT NOT NULL,
    "receipt_kind" TEXT NOT NULL,
    "author" TEXT NOT NULL,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("receipt_id")
);

-- CreateTable
CREATE TABLE "substreams_history" (
    "id" SERIAL NOT NULL,
    "op" CHAR(1),
    "table_name" TEXT,
    "pk" TEXT,
    "prev_value" TEXT,
    "block_num" BIGINT,

    CONSTRAINT "substreams_history_pkey" PRIMARY KEY ("id")
);

