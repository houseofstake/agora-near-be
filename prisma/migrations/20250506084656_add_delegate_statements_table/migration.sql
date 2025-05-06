-- CreateTable
CREATE TABLE "delegate_statements" (
    "address" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "twitter" TEXT,
    "discord" TEXT,
    "email" TEXT,
    "created_at" DATE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATE DEFAULT CURRENT_TIMESTAMP,
    "warpcast" TEXT,
    "endorsed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "delegate_statements_pkey" PRIMARY KEY ("address")
);

-- CreateIndex
CREATE INDEX "idx_delegate_statements_email" ON "delegate_statements"("email");
