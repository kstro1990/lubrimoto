-- Tablas faltantes para Punto de Equilibrio y Gastos Fijos
-- Migration: 0001_new_tables.sql

-- ============================================
-- GASTOS FIJOS Y VARIABLES
-- ============================================
CREATE TABLE IF NOT EXISTS fixed_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    local_id INTEGER, -- ID de IndexedDB para referencia
    name TEXT NOT NULL, -- "Alquiler", "Servicios", "Nómina"
    amount_usd DECIMAL(12, 2) NOT NULL, -- Monto en dólares
    category TEXT NOT NULL DEFAULT 'fijo', -- 'fijo' | 'variable'
    frequency TEXT NOT NULL DEFAULT 'mensual', -- 'mensual' | 'semanal' | 'diario'
    is_active BOOLEAN NOT NULL DEFAULT true,
    start_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- CONFIGURACIÓN DE METAS
-- ============================================
CREATE TABLE IF NOT EXISTS goals_configuration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    local_id INTEGER,
    month INTEGER NOT NULL, -- 1-12
    year INTEGER NOT NULL, -- 2024, 2025, etc.
    desired_profit_usd DECIMAL(12, 2) NOT NULL, -- Ganancia meta del mes
    expected_margin_percent DECIMAL(5, 2) NOT NULL, -- % de margen esperado
    working_days INTEGER NOT NULL DEFAULT 26, -- Días laborales del mes
    break_even_calculated DECIMAL(12, 2), -- Calculado automáticamente
    monthly_goal_calculated DECIMAL(12, 2), -- Calculado automáticamente
    daily_goal_calculated DECIMAL(12, 2), -- Calculado automáticamente
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(month, year) -- Una configuración por mes/año
);

-- ============================================
-- HISTORIAL DE VENTAS VS METAS
-- ============================================
CREATE TABLE IF NOT EXISTS sales_goals_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    local_id INTEGER,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    total_sales_usd DECIMAL(12, 2) NOT NULL, -- Ventas reales del mes
    monthly_goal DECIMAL(12, 2) NOT NULL, -- Meta establecida
    compliance_percent DECIMAL(5, 2) NOT NULL, -- % de cumplimiento
    working_days_elapsed INTEGER NOT NULL,
    working_days_total INTEGER NOT NULL,
    average_daily_sales DECIMAL(12, 2) NOT NULL, -- Ventas / días transcurridos
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(month, year) -- Un registro por mes/año
);

-- ============================================
-- AGREGAR COLUMNA local_id A SALES (para evitar duplicados)
-- ============================================
-- Primero verificamos si la columna no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales' AND column_name = 'local_id'
    ) THEN
        ALTER TABLE sales ADD COLUMN local_id INTEGER;
    END IF;
END $$;

-- Crear índice para búsquedas rápidas por local_id
CREATE INDEX IF NOT EXISTS idx_sales_local_id ON sales(local_id);

-- ============================================
-- AGREGAR local_id A PRODUCTS (para consistencia)
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'local_id'
    ) THEN
        ALTER TABLE products ADD COLUMN local_id INTEGER;
    END IF;
END $$;

-- ============================================
-- AGREGAR local_id A SALE_ITEMS
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sale_items' AND column_name = 'local_id'
    ) THEN
        ALTER TABLE sale_items ADD COLUMN local_id INTEGER;
    END IF;
END $$;

-- ============================================
-- AGREGAR local_id A PAYMENTS
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'local_id'
    ) THEN
        ALTER TABLE payments ADD COLUMN local_id INTEGER;
    END IF;
END $$;

-- ============================================
-- AGREGAR local_id A EXCHANGE_RATES
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'exchange_rates' AND column_name = 'local_id'
    ) THEN
        ALTER TABLE exchange_rates ADD COLUMN local_id INTEGER;
    END IF;
END $$;

-- ============================================
-- HABILITAR REPLICA IDENTITY PARA LAS NUEVAS TABLAS
-- ============================================
ALTER TABLE fixed_expenses REPLICA IDENTITY FULL;
ALTER TABLE goals_configuration REPLICA IDENTITY FULL;
ALTER TABLE sales_goals_history REPLICA IDENTITY FULL;
