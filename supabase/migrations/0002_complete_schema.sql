-- Tablas completas para sincronización LubriMotos ERP
-- Migration: 0002_complete_schema.sql

-- ============================================
-- EXISTING TABLES - Add local_id columns with UNIQUE
-- ============================================

-- Add local_id to sales (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales' AND column_name = 'local_id'
    ) THEN
        ALTER TABLE sales ADD COLUMN local_id INTEGER UNIQUE;
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_sales_local_id ON sales(local_id);

-- Add local_id to products
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'local_id'
    ) THEN
        ALTER TABLE products ADD COLUMN local_id INTEGER UNIQUE;
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_products_local_id ON products(local_id);

-- Add local_id to sale_items
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sale_items' AND column_name = 'local_id'
    ) THEN
        ALTER TABLE sale_items ADD COLUMN local_id INTEGER UNIQUE;
    END IF;
END $$;

-- Add local_id to payments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'local_id'
    ) THEN
        ALTER TABLE payments ADD COLUMN local_id INTEGER UNIQUE;
    END IF;
END $$;

-- Add local_id to exchange_rates
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'exchange_rates' AND column_name = 'local_id'
    ) THEN
        ALTER TABLE exchange_rates ADD COLUMN local_id INTEGER UNIQUE;
    END IF;
END $$;

-- ============================================
-- NEW TABLES: Punto de Equilibrio and Goals
-- ============================================

-- Fixed Expenses (Gastos Fijos)
CREATE TABLE IF NOT EXISTS fixed_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    local_id INTEGER UNIQUE,
    name TEXT NOT NULL,
    amount_usd DECIMAL(12, 2) NOT NULL,
    category TEXT NOT NULL DEFAULT 'fijo',
    frequency TEXT NOT NULL DEFAULT 'mensual',
    is_active BOOLEAN NOT NULL DEFAULT true,
    start_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE fixed_expenses REPLICA IDENTITY FULL;
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_local_id ON fixed_expenses(local_id);

-- Goals Configuration (Configuración de Metas)
CREATE TABLE IF NOT EXISTS goals_configuration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    local_id INTEGER UNIQUE,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    desired_profit_usd DECIMAL(12, 2) NOT NULL,
    expected_margin_percent DECIMAL(5, 2) NOT NULL,
    working_days INTEGER NOT NULL DEFAULT 26,
    break_even_calculated DECIMAL(12, 2),
    monthly_goal_calculated DECIMAL(12, 2),
    daily_goal_calculated DECIMAL(12, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(month, year)
);
ALTER TABLE goals_configuration REPLICA IDENTITY FULL;
CREATE INDEX IF NOT EXISTS idx_goals_configuration_local_id ON goals_configuration(local_id);

-- Sales Goals History (Historial de Ventas vs Metas)
CREATE TABLE IF NOT EXISTS sales_goals_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    local_id INTEGER UNIQUE,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    total_sales_usd DECIMAL(12, 2) NOT NULL,
    monthly_goal DECIMAL(12, 2) NOT NULL,
    compliance_percent DECIMAL(5, 2) NOT NULL,
    working_days_elapsed INTEGER NOT NULL,
    working_days_total INTEGER NOT NULL,
    average_daily_sales DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(month, year)
);
ALTER TABLE sales_goals_history REPLICA IDENTITY FULL;
CREATE INDEX IF NOT EXISTS idx_sales_goals_history_local_id ON sales_goals_history(local_id);

-- ============================================
-- NEW TABLES: Customers
-- ============================================

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    local_id INTEGER UNIQUE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE customers REPLICA IDENTITY FULL;
CREATE INDEX IF NOT EXISTS idx_customers_local_id ON customers(local_id);

-- ============================================
-- NEW TABLES: Venezuela Price Calculation
-- ============================================

-- Currency Configuration (Configuración Cambiaria)
CREATE TABLE IF NOT EXISTS configuracion_cambiaria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    local_id INTEGER UNIQUE,
    tasa_bcv DECIMAL(14, 4) NOT NULL,
    tasa_paralelo DECIMAL(14, 4) NOT NULL,
    margen_global DECIMAL(5, 2) NOT NULL,
    fecha DATE NOT NULL,
    es_activa BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE configuracion_cambiaria REPLICA IDENTITY FULL;
CREATE INDEX IF NOT EXISTS idx_configuracion_cambiaria_local_id ON configuracion_cambiaria(local_id);

-- Rate History (Historial de Tasas) - YA CORREGIDO ARRIBA
-- Price Calculations (Cálculos de Precios)
CREATE TABLE IF NOT EXISTS calculos_precios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    local_id INTEGER UNIQUE,
    product_id INTEGER,
    config_id INTEGER,
    costo_usd DECIMAL(12, 2) NOT NULL,
    margen_porcentaje DECIMAL(5, 2) NOT NULL,
    tasa_bcv DECIMAL(14, 4) NOT NULL,
    tasa_paralelo DECIMAL(14, 4) NOT NULL,
    precio_base_usd DECIMAL(12, 2),
    factor_proteccion DECIMAL(5, 4),
    brecha_cambiaria DECIMAL(5, 2),
    precio_venta_usd DECIMAL(12, 2),
    precio_venta_bs_protegido DECIMAL(14, 2),
    precio_venta_bs_sin_proteccion DECIMAL(14, 2),
    ganancia_esperada_usd DECIMAL(12, 2),
    ganancia_real_usd DECIMAL(12, 2),
    ganancia_real_porcentaje DECIMAL(5, 2),
    perdida_por_brecha_usd DECIMAL(12, 2),
    perdida_por_brecha_porcentaje DECIMAL(5, 2),
    es_ganancia_baja BOOLEAN,
    es_perdida BOOLEAN,
    fecha_calculo TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE calculos_precios REPLICA IDENTITY FULL;
CREATE INDEX IF NOT EXISTS idx_calculos_precios_local_id ON calculos_precios(local_id);
CREATE INDEX IF NOT EXISTS idx_calculos_precios_product_id ON calculos_precios(product_id);

-- ============================================
-- NEW TABLES: Inventory Movements
-- ============================================

CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    local_id INTEGER UNIQUE,
    product_id INTEGER NOT NULL,
    product_sku TEXT NOT NULL,
    product_name TEXT NOT NULL,
    type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    reference_id INTEGER,
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE inventory_movements REPLICA IDENTITY FULL;
CREATE INDEX IF NOT EXISTS idx_inventory_movements_local_id ON inventory_movements(local_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id ON inventory_movements(product_id);

-- ============================================
-- Verify all tables created
-- ============================================
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_name IN (
    'products', 'sales', 'sale_items', 'payments', 'exchange_rates',
    'customers', 'fixed_expenses', 'goals_configuration', 'sales_goals_history',
    'configuracion_cambiaria', 'historial_tasas', 'calculos_precios', 'inventory_movements'
)
ORDER BY table_name;
