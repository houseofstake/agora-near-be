-- Create new delegate_statements table
CREATE TABLE "delegate_statements" (
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

  CONSTRAINT "delegate_statements_pkey" PRIMARY KEY ("address")
);

-- Create index on email
CREATE INDEX "idx_delegate_statements_email" ON "delegate_statements"("email"); 