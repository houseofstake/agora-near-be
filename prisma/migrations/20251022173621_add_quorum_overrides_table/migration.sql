-- CreateTable
CREATE TABLE "web2"."quorum_overrides" (
    "id" TEXT NOT NULL,
    "override_value" TEXT,
    "override_type" TEXT NOT NULL,
    "starting_from_id" DECIMAL NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "quorum_overrides_pkey" PRIMARY KEY ("id")
);
