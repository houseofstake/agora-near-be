CREATE TABLE IF NOT EXISTS web2.voting_power_cache (
    account_id VARCHAR(255) NOT NULL,
    voting_power DECIMAL(38, 0) NOT NULL,
    created_at TIMESTAMPTZ(6) DEFAULT NOW(),
    updated_at TIMESTAMPTZ(6) DEFAULT NOW(),
    CONSTRAINT voting_power_cache_pkey PRIMARY KEY (account_id)
);

CREATE INDEX IF NOT EXISTS idx_voting_power_cache_updated_at ON web2.voting_power_cache (updated_at);
