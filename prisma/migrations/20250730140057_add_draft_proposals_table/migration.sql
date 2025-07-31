-- CreateEnum
CREATE TYPE "web2"."DraftProposalStage" AS ENUM ('DRAFT', 'AWAITING_SUBMISSION', 'SUBMITTED');

-- CreateTable
CREATE TABLE "web2"."draft_proposals" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "proposal_url" TEXT,
    "author" TEXT NOT NULL,
    "stage" "web2"."DraftProposalStage" NOT NULL DEFAULT 'DRAFT',
    "voting_options" JSONB,
    "receipt_id" TEXT,
    "submitted_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "draft_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_draft_proposals_author" ON "web2"."draft_proposals"("author");

-- CreateIndex
CREATE INDEX "idx_draft_proposals_stage" ON "web2"."draft_proposals"("stage");
