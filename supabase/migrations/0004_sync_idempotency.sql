-- Migration: Idempotency keys for client-originated records
-- Adds `local_uuid` columns so the offline-first client can UPSERT safely
-- (retries collapse onto the same row instead of creating duplicates).

-- sales: client-generated idempotency key + actual sale timestamp
ALTER TABLE sales
    ADD COLUMN IF NOT EXISTS local_uuid UUID,
    ADD COLUMN IF NOT EXISTS sale_date TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_local_uuid
    ON sales(local_uuid)
    WHERE local_uuid IS NOT NULL;

COMMENT ON COLUMN sales.local_uuid IS 'Client-generated UUID used as idempotency key during sync';
COMMENT ON COLUMN sales.sale_date IS 'Actual sale timestamp from the client (may be earlier than created_at when synced offline)';

-- sale_items
ALTER TABLE sale_items
    ADD COLUMN IF NOT EXISTS local_uuid UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sale_items_local_uuid
    ON sale_items(local_uuid)
    WHERE local_uuid IS NOT NULL;

COMMENT ON COLUMN sale_items.local_uuid IS 'Client-generated UUID used as idempotency key during sync';

-- payments
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS local_uuid UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_local_uuid
    ON payments(local_uuid)
    WHERE local_uuid IS NOT NULL;

COMMENT ON COLUMN payments.local_uuid IS 'Client-generated UUID used as idempotency key during sync';

-- customers
ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS local_uuid UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_local_uuid
    ON customers(local_uuid)
    WHERE local_uuid IS NOT NULL;

COMMENT ON COLUMN customers.local_uuid IS 'Client-generated UUID used as idempotency key during sync';
