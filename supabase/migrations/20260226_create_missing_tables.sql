-- Migration: Create missing tables in Supabase
-- Run with: npx supabase db push or manually via Supabase dashboard

-- Table: historial_tasas (Exchange Rate History)
CREATE TABLE IF NOT EXISTS historial_tasas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tasa_bcv DECIMAL(15,2) NOT NULL,
  tasa_paralelo DECIMAL(15,2) NOT NULL,
  brecha DECIMAL(5,2),
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  fuente TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: configuracion_cambiaria (Exchange Rate Configuration)
CREATE TABLE IF NOT EXISTS configuracion_cambiaria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tasa_bcv DECIMAL(15,2) NOT NULL,
  tasa_paralelo DECIMAL(15,2) NOT NULL,
  margen_global DECIMAL(5,2),
  fecha DATE NOT NULL,
  es_activa BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Table: calculos_precios (Price Calculations)
CREATE TABLE IF NOT EXISTS calculos_precios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  config_id UUID REFERENCES configuracion_cambiaria(id),
  costo_usd DECIMAL(10,2),
  margen_porcentaje DECIMAL(5,2),
  tasa_bcv DECIMAL(15,2),
  tasa_paralelo DECIMAL(15,2),
  precio_base_usd DECIMAL(10,2),
  factor_proteccion DECIMAL(5,2),
  brecha_cambiaria DECIMAL(5,2),
  precio_venta_usd DECIMAL(10,2),
  precio_venta_bs_protegido DECIMAL(15,2),
  precio_venta_bs_sin_proteccion DECIMAL(15,2),
  ganancia_esperada_usd DECIMAL(10,2),
  ganancia_real_usd DECIMAL(10,2),
  ganancia_real_porcentaje DECIMAL(5,2),
  perdida_por_brecha_usd DECIMAL(10,2),
  perdida_por_brecha_porcentaje DECIMAL(5,2),
  es_ganancia_baja BOOLEAN,
  es_perdida BOOLEAN,
  fecha_calculo DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: sales_goals_history (Sales Goals History)
CREATE TABLE IF NOT EXISTS sales_goals_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  total_sales_usd DECIMAL(12,2),
  monthly_goal DECIMAL(12,2),
  compliance_percent DECIMAL(5,2),
  working_days_elapsed INTEGER,
  working_days_total INTEGER,
  average_daily_sales DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: goals_configuration (Goals Configuration)
CREATE TABLE IF NOT EXISTS goals_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  desired_profit_usd DECIMAL(12,2),
  expected_margin_percent DECIMAL(5,2),
  working_days INTEGER,
  break_even_calculated DECIMAL(12,2),
  monthly_goal_calculated DECIMAL(12,2),
  daily_goal_calculated DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  UNIQUE(month, year)
);

-- Enable RLS (Row Level Security) - optional but recommended
-- ALTER TABLE historial_tasas ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE configuracion_cambiaria ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE calculos_precios ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE sales_goals_history ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE goals_configuration ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_historial_tasas_fecha ON historial_tasas(fecha);
CREATE INDEX IF NOT EXISTS idx_configuracion_cambiaria_fecha ON configuracion_cambiaria(fecha);
CREATE INDEX IF NOT EXISTS idx_configuracion_cambiaria_activa ON configuracion_cambiaria(es_activa);
CREATE INDEX IF NOT EXISTS idx_calculos_precios_producto ON calculos_precios(product_id);
CREATE INDEX IF NOT EXISTS idx_calculos_precios_fecha ON calculos_precios(fecha_calculo);
CREATE INDEX IF NOT EXISTS idx_sales_goals_history_periodo ON sales_goals_history(year, month);
CREATE INDEX IF NOT EXISTS idx_goals_configuration_periodo ON goals_configuration(year, month);
