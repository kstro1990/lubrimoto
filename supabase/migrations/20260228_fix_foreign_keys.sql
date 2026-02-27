-- Fix sale_items to use product_sku instead of product_id (UUID)
-- Migration version 20260228

ALTER TABLE sale_items DROP CONSTRAINT IF EXISTS sale_items_product_id_fkey;
ALTER TABLE sale_items DROP COLUMN IF EXISTS product_id;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS product_sku TEXT;

-- Also fix inventory_movements to use product_sku TEXT instead of product_id UUID
ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_product_id_fkey;
ALTER TABLE inventory_movements DROP COLUMN IF EXISTS product_id;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS product_sku TEXT;
