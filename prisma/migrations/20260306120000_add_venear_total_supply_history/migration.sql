CREATE TABLE IF NOT EXISTS web2.venear_total_supply_history (
    recorded_at TIMESTAMPTZ(6) NOT NULL,
    block_height BIGINT NOT NULL,
    total_supply TEXT NOT NULL,
    PRIMARY KEY (recorded_at)
);
