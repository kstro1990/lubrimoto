-- Datos de prueba para LubriMotos ERP
-- Limpia datos existentes y genera nuevos

-- ============================================
-- 1. LIMPIAR DATOS EXISTENTES
-- ============================================

TRUNCATE TABLE payments CASCADE;
TRUNCATE TABLE sale_items CASCADE;
TRUNCATE TABLE sales CASCADE;
TRUNCATE TABLE exchange_rates CASCADE;
TRUNCATE TABLE products CASCADE;

-- ============================================
-- 2. INSERTAR PRODUCTOS (40 productos)
-- ============================================

INSERT INTO products (sku, name, description, cost_usd, price_usd, stock_quantity, min_stock_alert) VALUES
-- Lubricantes (5)
('ACE-001', 'Aceite de Motor 20W-50 1L', 'Aceite mineral para motos 4T', 25.00, 35.00, 45, 10),
('ACE-002', 'Aceite Sintético 10W-40 1L', 'Aceite sintético premium', 45.00, 65.00, 30, 5),
('ACE-003', 'Aceite 2T Mezcla 500ml', 'Aceite para motores 2 tiempos', 12.00, 18.00, 60, 15),
('ACE-004', 'Aceite de Horquilla 1L', 'Aceite hidráulico para suspensiones', 35.00, 50.00, 20, 5),
('ACE-005', 'Grasa para Cadenas 400g', 'Grasa especial para cadena de moto', 18.00, 28.00, 35, 8),

-- Filtros (4)
('FIL-001', 'Filtro de Aceite Genérico', 'Filtro compatible múltiples marcas', 8.00, 15.00, 80, 20),
('FIL-002', 'Filtro de Aire Honda', 'Filtro original Honda CBR', 22.00, 35.00, 25, 6),
('FIL-003', 'Filtro de Aire K&N', 'Filtro de alto rendimiento', 40.00, 65.00, 18, 4),
('FIL-004', 'Filtro de Combustible', 'Filtro universal de gasolina', 15.00, 25.00, 40, 10),

-- Bujías (4)
('BUJ-001', 'Bujía NGK CR7HSA', 'Bujía estándar NGK', 6.00, 12.00, 100, 25),
('BUJ-002', 'Bujía NGK Iridium CR8EIX', 'Bujía de iridium alto rendimiento', 25.00, 45.00, 40, 10),
('BUJ-003', 'Bujía Bosch WR7DC', 'Bujía Bosch estándar', 8.00, 16.00, 75, 18),
('BUJ-004', 'Bujía Denso Iridium', 'Bujía iridium Denso', 28.00, 52.00, 30, 8),

-- Frenos (5)
('FRE-001', 'Pastillas de Freno Delanteras', 'Pastillas orgánicas universales', 20.00, 35.00, 50, 12),
('FRE-002', 'Pastillas de Freno Traseras', 'Pastillas cerámicas', 22.00, 38.00, 45, 10),
('FRE-003', 'Discos de Freno 260mm', 'Discos flotantes deportivos', 45.00, 85.00, 15, 4),
('FRE-004', 'Líquido de Frenos DOT 4', 'Botella 500ml', 8.00, 15.00, 55, 15),
('FRE-005', 'Cable de Freno Delantero', 'Cable de acero reforzado', 12.00, 22.00, 30, 8),

-- Transmisión (4)
('TRA-001', 'Cadena 520 120 eslabones', 'Cadena reforzada dorada', 35.00, 65.00, 25, 6),
('TRA-002', 'Piñón 14 dientes 520', 'Piñón de acero templado', 18.00, 32.00, 20, 5),
('TRA-003', 'Corona 42 dientes 520', 'Corona de aluminio', 45.00, 85.00, 12, 3),
('TRA-004', 'Kit Transmisión Completo', 'Kit piñón + corona + cadena', 85.00, 160.00, 8, 2),

-- Neumáticos (4)
('NEU-001', 'Neumático Delantero 120/70-17', 'Michelin Pilot Street', 75.00, 120.00, 10, 3),
('NEU-002', 'Neumático Trasero 160/60-17', 'Michelin Pilot Street', 95.00, 145.00, 8, 2),
('NEU-003', 'Neumático 90/90-18', 'Dunlop para motos 150cc', 55.00, 95.00, 15, 4),
('NEU-004', 'Cámara de Aire 17"', 'Cámara reforzada', 15.00, 28.00, 25, 6),

-- Baterías (3)
('BAT-001', 'Batería YTZ7S Gel', 'Batería de gel 12V 6Ah', 45.00, 85.00, 12, 3),
('BAT-002', 'Batería YTX9-BS', 'Batería con electrolito', 55.00, 95.00, 10, 3),
('BAT-003', 'Cargador de Batería', 'Cargador automático 12V', 40.00, 75.00, 8, 2),

-- Accesorios (5)
('ACC-001', 'Cubre Cadena', 'Protector de cadena plástico', 12.00, 22.00, 30, 8),
('ACC-002', 'Slider Protector', 'Sliders anti-caída', 25.00, 45.00, 20, 5),
('ACC-003', 'Manecillas Deportivas', 'Manecillas aluminio rojas', 30.00, 55.00, 15, 4),
('ACC-004', 'Espejos Retrovisores', 'Par de espejos universales', 18.00, 35.00, 25, 6),
('ACC-005', 'Luces LED H4', 'Kit de conversión LED', 65.00, 120.00, 10, 3),

-- Repuestos Mecánicos (5)
('REP-001', 'Kit de Juntas Motor', 'Juego completo de juntas', 35.00, 65.00, 15, 4),
('REP-002', 'Retenes de Válvulas', 'Juego de retenes', 12.00, 25.00, 25, 6),
('REP-003', 'Tensor de Cadena', 'Tensor automático', 22.00, 40.00, 18, 5),
('REP-004', 'Kit Rodamientos Rueda', 'Rodamientos delanteros', 28.00, 52.00, 12, 3),
('REP-005', 'Retén de Horquilla', 'Par de retenes 41x53x8', 20.00, 38.00, 20, 5),

-- Limpieza y Mantenimiento (3)
('LIM-001', 'Limpiador de Cadena', 'Spray limpiador 500ml', 15.00, 28.00, 40, 10),
('LIM-002', 'Cera para Moto', 'Cera protectora UV', 22.00, 40.00, 20, 5),
('LIM-003', 'Limpia Parabrisas', 'Limpiador visera', 12.00, 22.00, 30, 8);

-- ============================================
-- 3. INSERTAR TASAS DE CAMBIO (30 registros)
-- ============================================

INSERT INTO exchange_rates (rate, recorded_at) VALUES
(36.50, NOW() - INTERVAL '30 days'),
(36.75, NOW() - INTERVAL '29 days'),
(36.90, NOW() - INTERVAL '28 days'),
(37.10, NOW() - INTERVAL '27 days'),
(37.25, NOW() - INTERVAL '26 days'),
(37.50, NOW() - INTERVAL '25 days'),
(37.80, NOW() - INTERVAL '24 days'),
(38.00, NOW() - INTERVAL '23 days'),
(38.25, NOW() - INTERVAL '22 days'),
(38.50, NOW() - INTERVAL '21 days'),
(38.75, NOW() - INTERVAL '20 days'),
(39.00, NOW() - INTERVAL '19 days'),
(39.25, NOW() - INTERVAL '18 days'),
(39.50, NOW() - INTERVAL '17 days'),
(39.75, NOW() - INTERVAL '16 days'),
(40.00, NOW() - INTERVAL '15 days'),
(40.25, NOW() - INTERVAL '14 days'),
(40.50, NOW() - INTERVAL '13 days'),
(40.75, NOW() - INTERVAL '12 days'),
(41.00, NOW() - INTERVAL '11 days'),
(41.25, NOW() - INTERVAL '10 days'),
(41.50, NOW() - INTERVAL '9 days'),
(41.75, NOW() - INTERVAL '8 days'),
(42.00, NOW() - INTERVAL '7 days'),
(42.25, NOW() - INTERVAL '6 days'),
(42.50, NOW() - INTERVAL '5 days'),
(42.75, NOW() - INTERVAL '4 days'),
(43.00, NOW() - INTERVAL '3 days'),
(43.25, NOW() - INTERVAL '2 days'),
(43.50, NOW() - INTERVAL '1 day');

-- ============================================
-- 4. INSERTAR VENTAS Y SUS ITEMS (15 ventas)
-- ============================================

-- Venta 1: Cambio de aceite básico
INSERT INTO sales (subtotal_usd, iva_amount_usd, igtf_amount_usd, total_amount_usd, exchange_rate_ves, total_amount_ves, created_at) 
VALUES (77.00, 12.32, 0.00, 89.32, 38.50, 3438.82, NOW() - INTERVAL '25 days');

INSERT INTO sale_items (sale_id, product_id, quantity, price_per_unit_usd)
SELECT 
    (SELECT id FROM sales ORDER BY created_at DESC LIMIT 1),
    id,
    CASE sku 
        WHEN 'ACE-001' THEN 2
        WHEN 'FIL-001' THEN 1
        WHEN 'BUJ-001' THEN 2
    END,
    price_usd
FROM products WHERE sku IN ('ACE-001', 'FIL-001', 'BUJ-001');

INSERT INTO payments (sale_id, method, amount) 
SELECT id, 'usd_cash', 89.32 FROM sales ORDER BY created_at DESC LIMIT 1;

-- Venta 2: Neumáticos nuevos
INSERT INTO sales (subtotal_usd, iva_amount_usd, igtf_amount_usd, total_amount_usd, exchange_rate_ves, total_amount_ves, created_at) 
VALUES (265.00, 42.40, 0.00, 307.40, 38.75, 11911.75, NOW() - INTERVAL '22 days');

INSERT INTO sale_items (sale_id, product_id, quantity, price_per_unit_usd)
SELECT 
    (SELECT id FROM sales ORDER BY created_at DESC LIMIT 1),
    id,
    1,
    price_usd
FROM products WHERE sku IN ('NEU-001', 'NEU-002');

INSERT INTO payments (sale_id, method, amount) 
SELECT id, 'usd_cash', 307.40 FROM sales ORDER BY created_at DESC LIMIT 1;

-- Venta 3: Revisión completa
INSERT INTO sales (subtotal_usd, iva_amount_usd, igtf_amount_usd, total_amount_usd, exchange_rate_ves, total_amount_ves, created_at) 
VALUES (395.00, 63.20, 0.00, 458.20, 39.00, 17869.80, NOW() - INTERVAL '20 days');

INSERT INTO sale_items (sale_id, product_id, quantity, price_per_unit_usd)
SELECT 
    (SELECT id FROM sales ORDER BY created_at DESC LIMIT 1),
    id,
    CASE sku 
        WHEN 'ACE-002' THEN 1
        WHEN 'FIL-003' THEN 1
        WHEN 'BUJ-002' THEN 2
        WHEN 'FRE-001' THEN 1
        WHEN 'FRE-002' THEN 1
        WHEN 'TRA-001' THEN 1
    END,
    price_usd
FROM products WHERE sku IN ('ACE-002', 'FIL-003', 'BUJ-002', 'FRE-001', 'FRE-002', 'TRA-001');

INSERT INTO payments (sale_id, method, amount, reference_code) 
SELECT id, 'ves_transfer', 458.20, 'REF-2024-001' FROM sales ORDER BY created_at DESC LIMIT 1;

-- Venta 4: Accesorios
INSERT INTO sales (subtotal_usd, iva_amount_usd, igtf_amount_usd, total_amount_usd, exchange_rate_ves, total_amount_ves, created_at) 
VALUES (210.00, 33.60, 0.00, 243.60, 39.25, 9561.30, NOW() - INTERVAL '18 days');

INSERT INTO sale_items (sale_id, product_id, quantity, price_per_unit_usd)
SELECT 
    (SELECT id FROM sales ORDER BY created_at DESC LIMIT 1),
    id,
    1,
    price_usd
FROM products WHERE sku IN ('ACC-002', 'ACC-003', 'ACC-005');

INSERT INTO payments (sale_id, method, amount, reference_code) 
SELECT id, 'pago_movil', 243.60, 'PM-2024-002' FROM sales ORDER BY created_at DESC LIMIT 1;

-- Venta 5: Transmisión completa
INSERT INTO sales (subtotal_usd, iva_amount_usd, igtf_amount_usd, total_amount_usd, exchange_rate_ves, total_amount_ves, created_at) 
VALUES (160.00, 25.60, 0.00, 185.60, 39.50, 7331.20, NOW() - INTERVAL '15 days');

INSERT INTO sale_items (sale_id, product_id, quantity, price_per_unit_usd)
SELECT 
    (SELECT id FROM sales ORDER BY created_at DESC LIMIT 1),
    id,
    1,
    price_usd
FROM products WHERE sku IN ('TRA-004');

INSERT INTO payments (sale_id, method, amount) 
SELECT id, 'usd_cash', 185.60 FROM sales ORDER BY created_at DESC LIMIT 1;

-- Venta 6: Batería y mantenimiento
INSERT INTO sales (subtotal_usd, iva_amount_usd, igtf_amount_usd, total_amount_usd, exchange_rate_ves, total_amount_ves, created_at) 
VALUES (172.00, 27.52, 0.00, 199.52, 40.00, 7980.80, NOW() - INTERVAL '12 days');

INSERT INTO sale_items (sale_id, product_id, quantity, price_per_unit_usd)
SELECT 
    (SELECT id FROM sales ORDER BY created_at DESC LIMIT 1),
    id,
    CASE sku 
        WHEN 'BAT-001' THEN 1
        WHEN 'LIM-001' THEN 2
        WHEN 'LIM-002' THEN 1
        WHEN 'BUJ-001' THEN 2
    END,
    price_usd
FROM products WHERE sku IN ('BAT-001', 'LIM-001', 'LIM-002', 'BUJ-001');

INSERT INTO payments (sale_id, method, amount, reference_code) 
SELECT id, 'ves_transfer', 199.52, 'REF-2024-003' FROM sales ORDER BY created_at DESC LIMIT 1;

-- Venta 7: Repuestos motor
INSERT INTO sales (subtotal_usd, iva_amount_usd, igtf_amount_usd, total_amount_usd, exchange_rate_ves, total_amount_ves, created_at) 
VALUES (200.00, 32.00, 0.00, 232.00, 40.25, 9338.00, NOW() - INTERVAL '10 days');

INSERT INTO sale_items (sale_id, product_id, quantity, price_per_unit_usd)
SELECT 
    (SELECT id FROM sales ORDER BY created_at DESC LIMIT 1),
    id,
    CASE sku 
        WHEN 'REP-001' THEN 1
        WHEN 'REP-002' THEN 2
        WHEN 'REP-004' THEN 2
        WHEN 'REP-005' THEN 1
    END,
    price_usd
FROM products WHERE sku IN ('REP-001', 'REP-002', 'REP-004', 'REP-005');

INSERT INTO payments (sale_id, method, amount) 
SELECT id, 'usd_cash', 100.00 FROM sales ORDER BY created_at DESC LIMIT 1;

INSERT INTO payments (sale_id, method, amount, reference_code) 
SELECT id, 'ves_transfer', 132.00, 'REF-2024-004' FROM sales ORDER BY created_at DESC LIMIT 1;

-- Venta 8: Frenos completos
INSERT INTO sales (subtotal_usd, iva_amount_usd, igtf_amount_usd, total_amount_usd, exchange_rate_ves, total_amount_ves, created_at) 
VALUES (188.00, 30.08, 0.00, 218.08, 40.50, 8832.24, NOW() - INTERVAL '8 days');

INSERT INTO sale_items (sale_id, product_id, quantity, price_per_unit_usd)
SELECT 
    (SELECT id FROM sales ORDER BY created_at DESC LIMIT 1),
    id,
    CASE sku 
        WHEN 'FRE-001' THEN 2
        WHEN 'FRE-002' THEN 2
        WHEN 'FRE-003' THEN 1
        WHEN 'FRE-004' THEN 2
    END,
    price_usd
FROM products WHERE sku IN ('FRE-001', 'FRE-002', 'FRE-003', 'FRE-004');

INSERT INTO payments (sale_id, method, amount) 
SELECT id, 'usd_cash', 218.08 FROM sales ORDER BY created_at DESC LIMIT 1;

-- Venta 9: Kit básico mantenimiento
INSERT INTO sales (subtotal_usd, iva_amount_usd, igtf_amount_usd, total_amount_usd, exchange_rate_ves, total_amount_ves, created_at) 
VALUES (58.00, 9.28, 0.00, 67.28, 41.00, 2758.48, NOW() - INTERVAL '6 days');

INSERT INTO sale_items (sale_id, product_id, quantity, price_per_unit_usd)
SELECT 
    (SELECT id FROM sales ORDER BY created_at DESC LIMIT 1),
    id,
    CASE sku 
        WHEN 'ACE-001' THEN 1
        WHEN 'FIL-001' THEN 1
        WHEN 'LIM-001' THEN 1
    END,
    price_usd
FROM products WHERE sku IN ('ACE-001', 'FIL-001', 'LIM-001');

INSERT INTO payments (sale_id, method, amount, reference_code) 
SELECT id, 'pago_movil', 67.28, 'PM-2024-005' FROM sales ORDER BY created_at DESC LIMIT 1;

-- Venta 10: Bujías y filtros
INSERT INTO sales (subtotal_usd, iva_amount_usd, igtf_amount_usd, total_amount_usd, exchange_rate_ves, total_amount_ves, created_at) 
VALUES (180.00, 28.80, 0.00, 208.80, 41.25, 8613.00, NOW() - INTERVAL '5 days');

INSERT INTO sale_items (sale_id, product_id, quantity, price_per_unit_usd)
SELECT 
    (SELECT id FROM sales ORDER BY created_at DESC LIMIT 1),
    id,
    CASE sku 
        WHEN 'BUJ-002' THEN 4
        WHEN 'FIL-002' THEN 1
        WHEN 'FIL-004' THEN 1
    END,
    price_usd
FROM products WHERE sku IN ('BUJ-002', 'FIL-002', 'FIL-004');

INSERT INTO payments (sale_id, method, amount) 
SELECT id, 'usd_cash', 208.80 FROM sales ORDER BY created_at DESC LIMIT 1;

-- Venta 11: Transmisión y cadena
INSERT INTO sales (subtotal_usd, iva_amount_usd, igtf_amount_usd, total_amount_usd, exchange_rate_ves, total_amount_ves, created_at) 
VALUES (149.00, 23.84, 0.00, 172.84, 41.50, 7172.86, NOW() - INTERVAL '4 days');

INSERT INTO sale_items (sale_id, product_id, quantity, price_per_unit_usd)
SELECT 
    (SELECT id FROM sales ORDER BY created_at DESC LIMIT 1),
    id,
    CASE sku 
        WHEN 'TRA-002' THEN 1
        WHEN 'TRA-003' THEN 1
        WHEN 'TRA-001' THEN 1
    END,
    price_usd
FROM products WHERE sku IN ('TRA-002', 'TRA-003', 'TRA-001');

INSERT INTO payments (sale_id, method, amount, reference_code) 
SELECT id, 'ves_transfer', 172.84, 'REF-2024-006' FROM sales ORDER BY created_at DESC LIMIT 1;

-- Venta 12: Iluminación
INSERT INTO sales (subtotal_usd, iva_amount_usd, igtf_amount_usd, total_amount_usd, exchange_rate_ves, total_amount_ves, created_at) 
VALUES (120.00, 19.20, 0.00, 139.20, 42.00, 5846.40, NOW() - INTERVAL '3 days');

INSERT INTO sale_items (sale_id, product_id, quantity, price_per_unit_usd)
SELECT 
    (SELECT id FROM sales ORDER BY created_at DESC LIMIT 1),
    id,
    1,
    price_usd
FROM products WHERE sku IN ('ACC-005');

INSERT INTO payments (sale_id, method, amount) 
SELECT id, 'usd_cash', 139.20 FROM sales ORDER BY created_at DESC LIMIT 1;

-- Venta 13: Cables y frenos
INSERT INTO sales (subtotal_usd, iva_amount_usd, igtf_amount_usd, total_amount_usd, exchange_rate_ves, total_amount_ves, created_at) 
VALUES (65.00, 10.40, 0.00, 75.40, 42.25, 3185.65, NOW() - INTERVAL '2 days');

INSERT INTO sale_items (sale_id, product_id, quantity, price_per_unit_usd)
SELECT 
    (SELECT id FROM sales ORDER BY created_at DESC LIMIT 1),
    id,
    CASE sku 
        WHEN 'FRE-005' THEN 1
        WHEN 'FRE-001' THEN 1
    END,
    price_usd
FROM products WHERE sku IN ('FRE-005', 'FRE-001');

INSERT INTO payments (sale_id, method, amount, reference_code) 
SELECT id, 'pago_movil', 75.40, 'PM-2024-007' FROM sales ORDER BY created_at DESC LIMIT 1;

-- Venta 14: Batería
INSERT INTO sales (subtotal_usd, iva_amount_usd, igtf_amount_usd, total_amount_usd, exchange_rate_ves, total_amount_ves, created_at) 
VALUES (170.00, 27.20, 0.00, 197.20, 42.50, 8381.00, NOW() - INTERVAL '1 day');

INSERT INTO sale_items (sale_id, product_id, quantity, price_per_unit_usd)
SELECT 
    (SELECT id FROM sales ORDER BY created_at DESC LIMIT 1),
    id,
    CASE sku 
        WHEN 'BAT-002' THEN 1
        WHEN 'BAT-003' THEN 1
    END,
    price_usd
FROM products WHERE sku IN ('BAT-002', 'BAT-003');

INSERT INTO payments (sale_id, method, amount) 
SELECT id, 'usd_cash', 197.20 FROM sales ORDER BY created_at DESC LIMIT 1;

-- Venta 15: Venta grande - revisión completa
INSERT INTO sales (subtotal_usd, iva_amount_usd, igtf_amount_usd, total_amount_usd, exchange_rate_ves, total_amount_ves, created_at) 
VALUES (720.00, 115.20, 0.00, 835.20, 43.00, 35913.60, NOW());

INSERT INTO sale_items (sale_id, product_id, quantity, price_per_unit_usd)
SELECT 
    (SELECT id FROM sales ORDER BY created_at DESC LIMIT 1),
    id,
    CASE sku 
        WHEN 'ACE-002' THEN 2
        WHEN 'FIL-003' THEN 1
        WHEN 'BUJ-002' THEN 4
        WHEN 'NEU-001' THEN 1
        WHEN 'NEU-002' THEN 1
        WHEN 'FRE-001' THEN 2
        WHEN 'FRE-002' THEN 2
        WHEN 'TRA-004' THEN 1
        WHEN 'BAT-001' THEN 1
    END,
    price_usd
FROM products WHERE sku IN ('ACE-002', 'FIL-003', 'BUJ-002', 'NEU-001', 'NEU-002', 'FRE-001', 'FRE-002', 'TRA-004', 'BAT-001');

INSERT INTO payments (sale_id, method, amount) 
SELECT id, 'usd_cash', 400.00 FROM sales ORDER BY created_at DESC LIMIT 1;

INSERT INTO payments (sale_id, method, amount, reference_code) 
SELECT id, 'ves_transfer', 435.20, 'REF-2024-008' FROM sales ORDER BY created_at DESC LIMIT 1;
