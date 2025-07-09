/*
  Warnings:

  - You are about to drop the `cache` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `delegate_statements` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "web2";

-- DropTable
DROP TABLE "public"."cache";

-- DropTable
DROP TABLE "public"."delegate_statements";

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

-- CreateIndex
CREATE INDEX "idx_delegate_statements_email" ON "web2"."delegate_statements"("email");

-- CreateIndex
CREATE INDEX "idx_cache_expires_at" ON "web2"."cache"("expires_at");
