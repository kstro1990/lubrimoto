-- Add product_sku column to inventory_movements if it doesn't exist
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS product_sku TEXT;
