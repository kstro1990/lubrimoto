-- Migration: Sistema de Inventario Avanzado
-- Añade soporte para historial de movimientos y campos extendidos de productos

-- Crear tipo ENUM para tipos de movimiento
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'movement_type') THEN
        CREATE TYPE movement_type AS ENUM ('sale', 'purchase', 'adjustment', 'initial', 'return');
    END IF;
END $$;

-- Crear tipo ENUM para estado de sincronización
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sync_status') THEN
        CREATE TYPE sync_status AS ENUM ('pending', 'syncing', 'synced', 'error');
    END IF;
END $$;

-- Añadir nuevos campos a la tabla products
ALTER TABLE products 
    ADD COLUMN IF NOT EXISTS category TEXT,
    ADD COLUMN IF NOT EXISTS barcode TEXT,
    ADD COLUMN IF NOT EXISTS location TEXT,
    ADD COLUMN IF NOT EXISTS sync_status sync_status DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS sync_error TEXT,
    ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS local_id UUID;

-- Crear índices para búsquedas comunes
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_sync_status ON products(sync_status);

-- Tabla de movimientos de inventario
CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    product_sku TEXT NOT NULL,
    product_name TEXT NOT NULL,
    type movement_type NOT NULL,
    quantity INT NOT NULL,
    previous_stock INT NOT NULL,
    new_stock INT NOT NULL,
    reference_id UUID, -- ID de venta, compra, etc.
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para movimientos
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON inventory_movements(type);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at ON inventory_movements(created_at DESC);

-- Habilitar Realtime para la tabla de movimientos
ALTER TABLE inventory_movements REPLICA IDENTITY FULL;

-- Función para actualizar el updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar updated_at en products
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Función para registrar movimientos de stock automáticamente
CREATE OR REPLACE FUNCTION record_inventory_movement()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo registrar si el stock cambió
    IF OLD.stock_quantity IS NULL OR NEW.stock_quantity != OLD.stock_quantity THEN
        INSERT INTO inventory_movements (
            product_id,
            product_sku,
            product_name,
            type,
            quantity,
            previous_stock,
            new_stock,
            notes,
            created_by
        ) VALUES (
            NEW.id,
            NEW.sku,
            NEW.name,
            CASE 
                WHEN OLD.stock_quantity IS NULL THEN 'initial'::movement_type
                WHEN NEW.stock_quantity > OLD.stock_quantity THEN 'purchase'::movement_type
                WHEN NEW.stock_quantity < OLD.stock_quantity THEN 'adjustment'::movement_type
                ELSE 'adjustment'::movement_type
            END,
            NEW.stock_quantity - COALESCE(OLD.stock_quantity, 0),
            COALESCE(OLD.stock_quantity, 0),
            NEW.stock_quantity,
            'Actualización automática desde trigger',
            'system'
        );
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para registrar movimientos automáticamente
DROP TRIGGER IF EXISTS trg_inventory_movement ON products;
CREATE TRIGGER trg_inventory_movement
    AFTER INSERT OR UPDATE OF stock_quantity ON products
    FOR EACH ROW
    EXECUTE FUNCTION record_inventory_movement();

-- Vista para productos con stock bajo
CREATE OR REPLACE VIEW low_stock_products AS
SELECT 
    id,
    sku,
    name,
    stock_quantity,
    min_stock_alert,
    (stock_quantity <= min_stock_alert) as is_low_stock,
    supplier,
    category
FROM products
WHERE stock_quantity <= min_stock_alert
ORDER BY stock_quantity ASC;

-- Vista para resumen de movimientos por producto
CREATE OR REPLACE VIEW product_movement_summary AS
SELECT 
    p.id,
    p.sku,
    p.name,
    p.stock_quantity,
    COUNT(im.id) as total_movements,
    SUM(CASE WHEN im.type = 'sale' THEN im.quantity ELSE 0 END) as total_sold,
    SUM(CASE WHEN im.type = 'purchase' THEN im.quantity ELSE 0 END) as total_purchased,
    MAX(im.created_at) as last_movement_date
FROM products p
LEFT JOIN inventory_movements im ON p.id = im.product_id
GROUP BY p.id, p.sku, p.name, p.stock_quantity;

-- Comentarios para documentación
COMMENT ON TABLE inventory_movements IS 'Registro histórico de todos los cambios de stock';
COMMENT ON COLUMN inventory_movements.type IS 'Tipo de movimiento: venta, compra, ajuste, stock inicial, devolución';
COMMENT ON COLUMN inventory_movements.reference_id IS 'ID relacionado (venta, compra, etc.)';
COMMENT ON COLUMN products.category IS 'Categoría del producto para organización';
COMMENT ON COLUMN products.barcode IS 'Código de barras para escaneo';
COMMENT ON COLUMN products.location IS 'Ubicación física en el almacén';
