import Dexie, { Table } from 'dexie';

// Sync status enum
export enum SyncStatus {
  PENDING = 'pending',
  SYNCING = 'syncing',
  SYNCED = 'synced',
  ERROR = 'error'
}

// Movement types for inventory tracking
export enum MovementType {
  SALE = 'sale',
  PURCHASE = 'purchase',
  ADJUSTMENT = 'adjustment',
  INITIAL = 'initial',
  RETURN = 'return'
}

// Base interface with sync fields
export interface Syncable {
  id?: number;
  localId?: string; // UUID generated locally
  syncStatus?: SyncStatus;
  syncError?: string;
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Product extends Syncable {
  id?: number;
  sku: string;
  name: string;
  description?: string;
  costUsd?: number;
  priceUsd: number;
  stockQuantity: number;
  minStockAlert?: number;
  supplier?: string;
  category?: string;
  barcode?: string;
  location?: string;
}

export interface Customer extends Syncable {
  id?: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface Sale extends Syncable {
  id?: number;
  customerId?: number;
  subtotalUsd: number;
  ivaAmountUsd: number;
  igtfAmountUsd: number;
  totalAmountUsd: number;
  exchangeRateVes: number;
  totalAmountVes: number;
  date: Date;
}

export interface SaleItem extends Syncable {
  id?: number;
  saleId: number;
  productId: string;
  quantity: number;
  pricePerUnitUsd: number;
}

export interface Payment extends Syncable {
  id?: number;
  saleId: number;
  method: 'usd_cash' | 'ves_transfer' | 'pago_movil' | 'debit_card';
  amount: number;
  referenceCode?: string;
}

export interface ExchangeRate extends Syncable {
  id?: number;
  rate: number;
  recordedAt: Date;
}

// ============================================================================
// TASAS CAMBIARIAS VENEZUELA (BCV vs PARALELO)
// ============================================================================

export interface ConfiguracionCambiaria extends Syncable {
  id?: number;
  tasaBCV: number;           // Tasa oficial BCV
  tasaParalelo: number;      // Tasa paralelo/reposición
  margenGlobal: number;      // Margen de ganancia global (%)
  fecha: Date;
  esActiva: boolean;         // Si es la configuración actual
}

export interface HistorialTasa {
  id?: number;
  tasaBCV: number;
  tasaParalelo: number;
  brecha: number;            // Diferencia porcentual
  fecha: Date;
  hora: string;              // HH:MM
  fuente?: string;
  createdAt: Date;
}

export interface CalculoPrecioVenezuela {
  id?: number;
  productId: number;
  configId: number;
  
  // Entradas
  costoUSD: number;
  margenPorcentaje: number;
  tasaBCV: number;
  tasaParalelo: number;
  
  // Cálculos
  precioBaseUSD: number;
  factorProteccion: number;
  brechaCambiaria: number;
  
  // Precios finales
  precioVentaUSD: number;
  precioVentaBsProtegido: number;
  precioVentaBsSinProteccion: number;
  
  // Análisis
  gananciaEsperadaUSD: number;
  gananciaRealUSD: number;
  gananciaRealPorcentaje: number;
  perdidaPorBrechaUSD: number;
  perdidaPorBrechaPorcentaje: number;
  
  // Alertas
  esGananciaBaja: boolean;
  esPerdida: boolean;
  
  fechaCalculo: Date;
  createdAt: Date;
}

// Inventory movement tracking
export interface InventoryMovement {
  id?: number;
  productId: number;
  productSku: string;
  productName: string;
  type: MovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  referenceId?: number; // Sale ID, Purchase ID, etc.
  notes?: string;
  createdBy?: string;
  createdAt: Date;
}

export class LubriMotosDB extends Dexie {
  products!: Table<Product>;
  customers!: Table<Customer>;
  sales!: Table<Sale>;
  saleItems!: Table<SaleItem>;
  payments!: Table<Payment>;
  exchangeRates!: Table<ExchangeRate>;
  inventoryMovements!: Table<InventoryMovement>;
  syncQueue!: Table<{
    id?: number;
    tableName: string;
    recordId: number;
    operation: 'create' | 'update' | 'delete';
    createdAt: Date;
    attempts: number;
    error?: string;
  }>;
  
  // Nuevas tablas para cálculo de precios Venezuela
  configuracionCambiaria!: Table<ConfiguracionCambiaria>;
  historialTasas!: Table<HistorialTasa>;
  calculosPrecios!: Table<CalculoPrecioVenezuela>;

  constructor() {
    super('lubrimotos-erp-db');
    
    // Version 4 - Original schema
    this.version(4).stores({
      products: '++id, sku, name, category, barcode, syncStatus, updatedAt, lastSyncAt',
      customers: '++id, name, syncStatus, updatedAt, lastSyncAt',
      sales: '++id, date, syncStatus, updatedAt, lastSyncAt',
      saleItems: '++id, saleId, productId, syncStatus, lastSyncAt',
      payments: '++id, saleId, syncStatus, lastSyncAt',
      exchangeRates: '++id, recordedAt',
      inventoryMovements: '++id, productId, type, createdAt',
      syncQueue: '++id, tableName, createdAt',
    });
    
    // Version 5 - Add createdAt index for products (needed for SKU generation)
    this.version(5).stores({
      products: '++id, sku, name, category, barcode, syncStatus, updatedAt, lastSyncAt, createdAt',
      customers: '++id, name, syncStatus, updatedAt, lastSyncAt',
      sales: '++id, date, syncStatus, updatedAt, lastSyncAt',
      saleItems: '++id, saleId, productId, syncStatus, lastSyncAt',
      payments: '++id, saleId, syncStatus, lastSyncAt',
      exchangeRates: '++id, recordedAt',
      inventoryMovements: '++id, productId, type, createdAt',
      syncQueue: '++id, tableName, createdAt',
    });
    
    // Version 6 - Add tables for Venezuela price calculation
    this.version(6).stores({
      products: '++id, sku, name, category, barcode, syncStatus, updatedAt, lastSyncAt, createdAt',
      customers: '++id, name, syncStatus, updatedAt, lastSyncAt',
      sales: '++id, date, syncStatus, updatedAt, lastSyncAt',
      saleItems: '++id, saleId, productId, syncStatus, lastSyncAt',
      payments: '++id, saleId, syncStatus, lastSyncAt',
      exchangeRates: '++id, recordedAt',
      inventoryMovements: '++id, productId, type, createdAt',
      syncQueue: '++id, tableName, createdAt',
      // New tables
      configuracionCambiaria: '++id, fecha, esActiva, updatedAt',
      historialTasas: '++id, fecha, hora, createdAt',
      calculosPrecios: '++id, productId, configId, fechaCalculo, createdAt',
    });
  }
}

export const db = new LubriMotosDB();

// Helper to generate UUID locally
export function generateUUID(): string {
  return crypto.randomUUID();
}

// Generate unique SKU
export async function generateSKU(): Promise<string> {
  const prefix = 'PROD';
  const date = new Date();
  const timestamp = date.getFullYear().toString().slice(-2) +
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0');
  
  // Get count of products created today to generate sequential number
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const count = await db.products
    .where('createdAt')
    .above(today)
    .count();
  
  const sequence = String(count + 1).padStart(4, '0');
  const sku = `${prefix}-${timestamp}-${sequence}`;
  
  // Verify uniqueness
  const existing = await db.products.where('sku').equals(sku).first();
  if (existing) {
    // If collision, add random suffix
    const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${sku}-${randomSuffix}`;
  }
  
  return sku;
}

// Record inventory movement
export async function recordInventoryMovement(
  product: Product,
  type: MovementType,
  quantity: number,
  referenceId?: number,
  notes?: string,
  createdBy?: string
): Promise<void> {
  const previousStock = type === MovementType.INITIAL 
    ? 0 
    : product.stockQuantity - quantity;
  
  await db.inventoryMovements.add({
    productId: product.id!,
    productSku: product.sku,
    productName: product.name,
    type,
    quantity,
    previousStock,
    newStock: product.stockQuantity,
    referenceId,
    notes,
    createdBy,
    createdAt: new Date(),
  });
}

// Initialize database with default data
export async function initializeDatabase() {
  const productsCount = await db.products.count();
  if (productsCount === 0) {
    console.log('Initializing database with default products...');
    const now = new Date();
    
    const defaultProducts: Product[] = [
      { 
        sku: 'PROD-001', 
        name: 'Aceite de Motor Sintético 1L', 
        stockQuantity: 50, 
        priceUsd: 40.00, 
        costUsd: 28.00,
        supplier: 'Proveedor A',
        category: 'Lubricantes',
        syncStatus: SyncStatus.PENDING,
        createdAt: now,
        updatedAt: now
      },
      { 
        sku: 'PROD-002', 
        name: 'Filtro de Aire Deportivo K&N', 
        stockQuantity: 30, 
        priceUsd: 22.50, 
        costUsd: 15.00,
        supplier: 'Proveedor B',
        category: 'Filtros',
        syncStatus: SyncStatus.PENDING,
        createdAt: now,
        updatedAt: now
      },
      { 
        sku: 'PROD-003', 
        name: 'Bujías Iridium NGK (unidad)', 
        stockQuantity: 120, 
        priceUsd: 15.00, 
        costUsd: 10.00,
        supplier: 'Proveedor A',
        category: 'Bujías',
        syncStatus: SyncStatus.PENDING,
        createdAt: now,
        updatedAt: now
      },
      { 
        sku: 'PROD-004', 
        name: 'Líquido de Frenos DOT4 500ml', 
        stockQuantity: 80, 
        priceUsd: 10.75, 
        costUsd: 7.50,
        supplier: 'Proveedor C',
        category: 'Líquidos',
        syncStatus: SyncStatus.PENDING,
        createdAt: now,
        updatedAt: now
      },
      { 
        sku: 'PROD-005', 
        name: 'Limpiador de Inyectores Liqui Moly', 
        stockQuantity: 45, 
        priceUsd: 15.50, 
        costUsd: 11.00,
        supplier: 'Proveedor B',
        category: 'Aditivos',
        syncStatus: SyncStatus.PENDING,
        createdAt: now,
        updatedAt: now
      },
      { 
        sku: 'PROD-006', 
        name: 'Pastillas de Freno Delanteras', 
        stockQuantity: 60, 
        priceUsd: 35.00, 
        costUsd: 24.00,
        supplier: 'Proveedor C',
        category: 'Frenos',
        syncStatus: SyncStatus.PENDING,
        createdAt: now,
        updatedAt: now
      },
    ];

    for (const product of defaultProducts) {
      const id = await db.products.add(product);
      // Record initial stock movement
      await recordInventoryMovement(
        { ...product, id },
        MovementType.INITIAL,
        product.stockQuantity,
        undefined,
        'Stock inicial al crear el producto'
      );
    }
  }
}

// Open database and initialize if needed
if (typeof window !== 'undefined') {
  db.open()
    .then(initializeDatabase)
    .catch(err => {
      console.error('Failed to open database:', err);
    });
}

export default db;
