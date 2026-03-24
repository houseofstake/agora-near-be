-- CreateEnum
CREATE TYPE "web2"."GovernanceRole" AS ENUM ('SCREENING', 'COUNCIL');

-- CreateEnum
CREATE TYPE "web2"."ReviewAction" AS ENUM ('APPROVE', 'REJECT', 'VETO', 'COMMENT');

-- CreateEnum
CREATE TYPE "web2"."ScreeningStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "web2"."CouncilStatus" AS ENUM ('ACTIVE', 'RATIFIED', 'VETOED');

-- CreateTable
CREATE TABLE "web2"."governance_members" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subtitle" TEXT,
    "role" "web2"."GovernanceRole" NOT NULL,
    "appointed_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "governance_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "web2"."governance_reviews" (
    "id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "action" "web2"."ReviewAction" NOT NULL,
    "rationale" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "governance_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "web2"."proposal_governance_status" (
    "proposal_id" TEXT NOT NULL,
    "screening_status" "web2"."ScreeningStatus" NOT NULL DEFAULT 'PENDING',
    "screening_deadline" TIMESTAMP(6),
    "council_status" "web2"."CouncilStatus",
    "veto_deadline" TIMESTAMP(6),
    "ratified_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "proposal_governance_status_pkey" PRIMARY KEY ("proposal_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "governance_members_wallet_key" ON "web2"."governance_members"("wallet");

-- CreateIndex
CREATE INDEX "idx_governance_members_role" ON "web2"."governance_members"("role");

-- CreateIndex
CREATE INDEX "idx_governance_reviews_proposal_id" ON "web2"."governance_reviews"("proposal_id");

-- CreateIndex
CREATE INDEX "idx_governance_reviews_member_id" ON "web2"."governance_reviews"("member_id");

-- Partial unique index: one APPROVE or REJECT per member per proposal (COMMENTs and VETOs are unrestricted)
CREATE UNIQUE INDEX "uq_governance_reviews_vote"
    ON "web2"."governance_reviews"("proposal_id", "member_id")
    WHERE "action" IN ('APPROVE', 'REJECT');

-- AddForeignKey
ALTER TABLE "web2"."governance_reviews" ADD CONSTRAINT "governance_reviews_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "web2"."governance_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
