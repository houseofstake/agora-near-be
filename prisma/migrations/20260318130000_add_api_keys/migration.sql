-- CreateTable
CREATE TABLE "web2"."api_keys" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "metadata" JSONB,
    "last_used_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_key" ON "web2"."api_keys"("key");

-- CreateIndex
CREATE INDEX "idx_api_keys_account_id" ON "web2"."api_keys"("account_id");

-- CreateIndex
CREATE INDEX "idx_api_keys_key" ON "web2"."api_keys"("key");
