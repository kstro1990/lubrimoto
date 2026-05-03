-- Migration: Tabla de clientes y vinculación con ventas
-- Permite sincronizar clientes desde IndexedDB a Supabase

-- Tabla de clientes
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    sync_status sync_status DEFAULT 'synced',
    sync_error TEXT,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para búsquedas comunes
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_sync_status ON customers(sync_status);

-- Añadir columna customer_id a sales (referencia opcional)
ALTER TABLE sales
    ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);

-- Trigger para actualizar updated_at en customers
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Habilitar Realtime para customers
ALTER TABLE customers REPLICA IDENTITY FULL;

COMMENT ON TABLE customers IS 'Clientes del negocio, sincronizados desde la app offline-first';
COMMENT ON COLUMN sales.customer_id IS 'Cliente asociado a la venta (opcional)';
