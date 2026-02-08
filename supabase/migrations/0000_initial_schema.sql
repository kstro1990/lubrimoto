-- Habilitar UUID para claves primarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabla de productos
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    cost_usd DECIMAL(12, 2) NOT NULL,
    price_usd DECIMAL(12, 2) NOT NULL,
    stock_quantity INT NOT NULL DEFAULT 0,
    min_stock_alert INT NOT NULL DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla de ventas (facturas)
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Total en USD antes de impuestos
    subtotal_usd DECIMAL(12, 2) NOT NULL,
    -- Monto del IVA (16%) en USD
    iva_amount_usd DECIMAL(12, 2) NOT NULL,
    -- Monto del IGTF (3%) si aplica
    igtf_amount_usd DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    -- Total final en USD
    total_amount_usd DECIMAL(12, 2) NOT NULL,
    -- Tasa de cambio usada en la transacción
    exchange_rate_ves DECIMAL(14, 4) NOT NULL,
    -- Monto total en Bolívares (referencial)
    total_amount_ves DECIMAL(14, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla de ítems de una venta (relación muchos a muchos)
CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INT NOT NULL,
    -- Precio al momento de la venta para histórico
    price_per_unit_usd DECIMAL(12, 2) NOT NULL, 
    UNIQUE(sale_id, product_id)
);

-- Tipos de métodos de pago
CREATE TYPE payment_method AS ENUM ('usd_cash', 'ves_transfer', 'pago_movil', 'debit_card');

-- Tabla de pagos por venta (una venta puede tener múltiples pagos)
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    method payment_method NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    -- El 'amount' se interpreta en la moneda principal de la transacción (USD)
    -- o se puede añadir una columna 'currency' si se necesita más granularidad.
    reference_code TEXT -- Para Pago Móvil o transferencias
);

-- Tabla para el histórico de la tasa de cambio
CREATE TABLE exchange_rates (
    id SERIAL PRIMARY KEY,
    rate DECIMAL(14, 4) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Para habilitar Realtime y sincronización
ALTER TABLE products REPLICA IDENTITY FULL;
ALTER TABLE sales REPLICA IDENTITY FULL;
-- etc para cada tabla que necesite sincro...

-- Esto es fundamental para que puedas suscribirte a cambios en las tablas.