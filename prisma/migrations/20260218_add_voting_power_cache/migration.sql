-- CreateTable
CREATE TABLE IF NOT EXISTS web2.voting_power_cache (
    account_id TEXT PRIMARY KEY,
    voting_power DECIMAL NOT NULL,
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);
