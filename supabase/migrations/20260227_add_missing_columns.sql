-- Migration: Add missing columns to existing tables in Supabase
-- Run this SQL in Supabase SQL Editor to fix missing columns

-- ============================================================================
-- PRODUCTS TABLE
-- ============================================================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced';

-- ============================================================================
-- SALES TABLE  
-- ============================================================================
ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS subtotal_usd DECIMAL(12,2);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS iva_amount_usd DECIMAL(12,2);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS igtf_amount_usd DECIMAL(12,2);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS total_amount_usd DECIMAL(12,2);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS exchange_rate_ves DECIMAL(15,6);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS total_amount_ves DECIMAL(15,2);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE sales ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced';

-- ============================================================================
-- SALE_ITEMS TABLE
-- ============================================================================
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS sale_id UUID REFERENCES sales(id);
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS quantity INTEGER;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS price_per_unit_usd DECIMAL(12,2);
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced';

-- ============================================================================
-- CUSTOMERS TABLE
-- ============================================================================
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced';

-- ============================================================================
-- PAYMENTS TABLE (if exists)
-- ============================================================================
-- ALTER TABLE payments ADD COLUMN IF NOT EXISTS sale_id UUID REFERENCES sales(id);
-- ALTER TABLE payments ADD COLUMN IF NOT EXISTS method TEXT;
-- ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount DECIMAL(12,2);
-- ALTER TABLE payments ADD COLUMN IF NOT EXISTS reference_code TEXT;
-- ALTER TABLE payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- EXCHANGE_RATES TABLE
-- ============================================================================
ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS rate DECIMAL(15,6);
ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- INVENTORY_MOVEMENTS TABLE
-- ============================================================================
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS product_sku TEXT;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS quantity INTEGER;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS previous_stock INTEGER;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS new_stock INTEGER;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS reference_id UUID;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ============================================================================
-- FIXED_EXPENSES TABLE
-- ============================================================================
ALTER TABLE fixed_expenses ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE fixed_expenses ADD COLUMN IF NOT EXISTS amount_usd DECIMAL(12,2);
ALTER TABLE fixed_expenses ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE fixed_expenses ADD COLUMN IF NOT EXISTS frequency TEXT;
ALTER TABLE fixed_expenses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE fixed_expenses ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE fixed_expenses ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE fixed_expenses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE fixed_expenses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ============================================================================
-- GOALS_CONFIGURATION TABLE
-- ============================================================================
ALTER TABLE goals_configuration ADD COLUMN IF NOT EXISTS month INTEGER;
ALTER TABLE goals_configuration ADD COLUMN IF NOT EXISTS year INTEGER;
ALTER TABLE goals_configuration ADD COLUMN IF NOT EXISTS desired_profit_usd DECIMAL(12,2);
ALTER TABLE goals_configuration ADD COLUMN IF NOT EXISTS expected_margin_percent DECIMAL(5,2);
ALTER TABLE goals_configuration ADD COLUMN IF NOT EXISTS working_days INTEGER;
ALTER TABLE goals_configuration ADD COLUMN IF NOT EXISTS break_even_calculated DECIMAL(12,2);
ALTER TABLE goals_configuration ADD COLUMN IF NOT EXISTS monthly_goal_calculated DECIMAL(12,2);
ALTER TABLE goals_configuration ADD COLUMN IF NOT EXISTS daily_goal_calculated DECIMAL(10,2);
ALTER TABLE goals_configuration ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE goals_configuration ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ============================================================================
-- SALES_GOALS_HISTORY TABLE
-- ============================================================================
ALTER TABLE sales_goals_history ADD COLUMN IF NOT EXISTS month INTEGER;
ALTER TABLE sales_goals_history ADD COLUMN IF NOT EXISTS year INTEGER;
ALTER TABLE sales_goals_history ADD COLUMN IF NOT EXISTS total_sales_usd DECIMAL(12,2);
ALTER TABLE sales_goals_history ADD COLUMN IF NOT EXISTS monthly_goal DECIMAL(12,2);
ALTER TABLE sales_goals_history ADD COLUMN IF NOT EXISTS compliance_percent DECIMAL(5,2);
ALTER TABLE sales_goals_history ADD COLUMN IF NOT EXISTS working_days_elapsed INTEGER;
ALTER TABLE sales_goals_history ADD COLUMN IF NOT EXISTS working_days_total INTEGER;
ALTER TABLE sales_goals_history ADD COLUMN IF NOT EXISTS average_daily_sales DECIMAL(10,2);
ALTER TABLE sales_goals_history ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- HISTORIAL_TASAS TABLE
-- ============================================================================
ALTER TABLE historial_tasas ADD COLUMN IF NOT EXISTS tasa_bcv DECIMAL(15,2);
ALTER TABLE historial_tasas ADD COLUMN IF NOT EXISTS tasa_paralelo DECIMAL(15,2);
ALTER TABLE historial_tasas ADD COLUMN IF NOT EXISTS brecha DECIMAL(5,2);
ALTER TABLE historial_tasas ADD COLUMN IF NOT EXISTS fecha DATE;
ALTER TABLE historial_tasas ADD COLUMN IF NOT EXISTS hora TIME;
ALTER TABLE historial_tasas ADD COLUMN IF NOT EXISTS fuente TEXT;
ALTER TABLE historial_tasas ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- CONFIGURACION_CAMBIARIA TABLE
-- ============================================================================
ALTER TABLE configuracion_cambiaria ADD COLUMN IF NOT EXISTS tasa_bcv DECIMAL(15,2);
ALTER TABLE configuracion_cambiaria ADD COLUMN IF NOT EXISTS tasa_paralelo DECIMAL(15,2);
ALTER TABLE configuracion_cambiaria ADD COLUMN IF NOT EXISTS margen_global DECIMAL(5,2);
ALTER TABLE configuracion_cambiaria ADD COLUMN IF NOT EXISTS fecha DATE;
ALTER TABLE configuracion_cambiaria ADD COLUMN IF NOT EXISTS es_activa BOOLEAN DEFAULT false;
ALTER TABLE configuracion_cambiaria ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE configuracion_cambiaria ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ============================================================================
-- CALCULOS_PRECIOS TABLE
-- ============================================================================
ALTER TABLE calculos_precios ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);
ALTER TABLE calculos_precios ADD COLUMN IF NOT EXISTS config_id UUID REFERENCES configuracion_cambiaria(id);
ALTER TABLE calculos_precios ADD COLUMN IF NOT EXISTS costo_usd DECIMAL(10,2);
ALTER TABLE calculos_precios ADD COLUMN IF NOT EXISTS margen_porcentaje DECIMAL(5,2);
ALTER TABLE calculos_precios ADD COLUMN IF NOT EXISTS tasa_bcv DECIMAL(15,2);
ALTER TABLE calculos_precios ADD COLUMN IF NOT EXISTS tasa_paralelo DECIMAL(15,2);
ALTER TABLE calculos_precios ADD COLUMN IF NOT EXISTS precio_base_usd DECIMAL(10,2);
ALTER TABLE calculos_precios ADD COLUMN IF NOT EXISTS factor_proteccion DECIMAL(5,2);
ALTER TABLE calculos_precios ADD COLUMN IF NOT EXISTS brecha_cambiaria DECIMAL(5,2);
ALTER TABLE calculos_precios ADD COLUMN IF NOT EXISTS precio_venta_usd DECIMAL(10,2);
ALTER TABLE calculos_precios ADD COLUMN IF NOT EXISTS precio_venta_bs_protegido DECIMAL(15,2);
ALTER TABLE calculos_precios ADD COLUMN IF NOT EXISTS precio_venta_bs_sin_proteccion DECIMAL(15,2);
ALTER TABLE calculos_precios ADD COLUMN IF NOT EXISTS ganancia_esperada_usd DECIMAL(10,2);
ALTER TABLE calculos_precios ADD COLUMN IF NOT EXISTS ganancia_real_usd DECIMAL(10,2);
ALTER TABLE calculos_precios ADD COLUMN IF NOT EXISTS ganancia_real_porcentaje DECIMAL(5,2);
ALTER TABLE calculos_precios ADD COLUMN IF NOT EXISTS perdida_por_brecha_usd DECIMAL(10,2);
ALTER TABLE calculos_precios ADD COLUMN IF NOT EXISTS perdida_por_brecha_porcentaje DECIMAL(5,2);
ALTER TABLE calculos_precios ADD COLUMN IF NOT EXISTS es_ganancia_baja BOOLEAN;
ALTER TABLE calculos_precios ADD COLUMN IF NOT EXISTS es_perdida BOOLEAN;
ALTER TABLE calculos_precios ADD COLUMN IF NOT EXISTS fecha_calculo DATE;
ALTER TABLE calculos_precios ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- CREATE INDEXES (if not exist)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at ON inventory_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_historial_tasas_fecha ON historial_tasas(fecha);
CREATE INDEX IF NOT EXISTS idx_configuracion_cambiaria_activa ON configuracion_cambiaria(es_activa);

SELECT 'Migration completed successfully!' as status;
