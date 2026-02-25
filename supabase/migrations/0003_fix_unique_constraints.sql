-- Script de corrección: Agregar restricciones UNIQUE a local_id
-- Ejecutar esto si las tablas ya existen y tienen datos

-- Agregar UNIQUE a sales.local_id (si no existe)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales' AND column_name = 'local_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'sales_local_id_key'
    ) THEN
        ALTER TABLE sales ADD CONSTRAINT sales_local_id_key UNIQUE (local_id);
    END IF;
END $$;

-- Agregar UNIQUE a products.local_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'local_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'products_local_id_key'
    ) THEN
        ALTER TABLE products ADD CONSTRAINT products_local_id_key UNIQUE (local_id);
    END IF;
END $$;

-- Agregar UNIQUE a sale_items.local_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sale_items' AND column_name = 'local_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'sale_items_local_id_key'
    ) THEN
        ALTER TABLE sale_items ADD CONSTRAINT sale_items_local_id_key UNIQUE (local_id);
    END IF;
END $$;

-- Agregar UNIQUE a payments.local_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'local_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payments_local_id_key'
    ) THEN
        ALTER TABLE payments ADD CONSTRAINT payments_local_id_key UNIQUE (local_id);
    END IF;
END $$;

-- Agregar UNIQUE a exchange_rates.local_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'exchange_rates' AND column_name = 'local_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'exchange_rates_local_id_key'
    ) THEN
        ALTER TABLE exchange_rates ADD CONSTRAINT exchange_rates_local_id_key UNIQUE (local_id);
    END IF;
END $$;

-- Verificar restricciones
SELECT 
    tc.table_name,
    kcu.column_name,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'UNIQUE'
AND tc.table_schema = 'public'
AND kcu.column_name = 'local_id'
ORDER BY tc.table_name;
