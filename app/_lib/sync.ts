import { supabase } from './supabase';
import db, { SyncStatus, Product, Sale, SaleItem, Customer } from '../_db/db';
import { logInfo, logError, logWarn } from './logger';

// Simple event emitter for sync status
class SyncEventEmitter {
  private listeners: Map<string, Set<Function>> = new Map();

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback);
  }

  emit(event: string, data?: any) {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }
}

export const syncEvents = new SyncEventEmitter();

// Check if online
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
}

// Listen for online/offline events
export function setupNetworkListeners() {
  if (typeof window === 'undefined') return;

  window.addEventListener('online', () => {
    syncEvents.emit('online');
    // Auto-sync when coming back online
    syncPendingData();
  });

  window.addEventListener('offline', () => {
    syncEvents.emit('offline');
  });
}

// Transform local product to Supabase format
function transformProductToSupabase(product: Product): any {
  return {
    sku: product.sku,
    name: product.name,
    description: product.description,
    cost_usd: product.costUsd,
    price_usd: product.priceUsd,
    stock_quantity: product.stockQuantity,
    min_stock_alert: product.minStockAlert || 5,
  };
}

// Transform Supabase product to local format
function transformProductFromSupabase(data: any): Omit<Product, 'id'> {
  return {
    localId: data.id,
    sku: data.sku,
    name: data.name,
    description: data.description,
    costUsd: data.cost_usd,
    priceUsd: data.price_usd,
    stockQuantity: data.stock_quantity,
    minStockAlert: data.min_stock_alert || 5,
    supplier: data.supplier,
    syncStatus: SyncStatus.SYNCED,
    lastSyncAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Transform local sale to Supabase format
function transformSaleToSupabase(sale: Sale, items: SaleItem[]): any {
  return {
    subtotal_usd: sale.subtotalUsd,
    iva_amount_usd: sale.ivaAmountUsd,
    igtf_amount_usd: sale.igtfAmountUsd,
    total_amount_usd: sale.totalAmountUsd,
    exchange_rate_ves: sale.exchangeRateVes,
    total_amount_ves: sale.totalAmountVes,
    items: items.map(item => ({
      quantity: item.quantity,
      price_per_unit_usd: item.pricePerUnitUsd,
      product_sku: item.productId,
    })),
  };
}

// Sync a single product to Supabase
async function syncProduct(product: Product): Promise<void> {
  logInfo('Syncing product', 'syncProduct', { sku: product.sku, name: product.name, id: product.id });
  
  try {
    // Transform product data
    const productData = transformProductToSupabase(product);
    logInfo('Transformed product data', 'syncProduct', { sku: product.sku, data: productData });
    
    // Send to Supabase
    const { data, error } = await supabase
      .from('products')
      .upsert(productData, { onConflict: 'sku' })
      .select()
      .single();

    if (error) {
      // Si el error es de duplicado, el producto ya existe, lo marcamos como sincronizado
      if (error.message && error.message.includes('duplicate key')) {
        logInfo('Product already exists in Supabase, marking as synced', 'syncProduct', { sku: product.sku });
        
        // Buscar el producto existente en Supabase para obtener su ID
        const { data: existingProduct } = await supabase
          .from('products')
          .select('id')
          .eq('sku', product.sku)
          .single();
        
        if (existingProduct && product.id) {
          await db.products.update(product.id, {
            syncStatus: SyncStatus.SYNCED,
            lastSyncAt: new Date(),
            localId: existingProduct.id,
            updatedAt: new Date(),
          });
          logInfo('Product marked as synced (already exists)', 'syncProduct', { sku: product.sku });
          return;
        }
      }
      
      logError('Supabase error', error, 'syncProduct', { sku: product.sku });
      throw new Error(`Supabase error: ${error.message}`);
    }

    if (!data) {
      throw new Error('No data returned from Supabase');
    }

    logInfo('Supabase response', 'syncProduct', { sku: product.sku, returnedId: data.id });

    // Update local record with sync status
    if (!product.id) {
      throw new Error('Product has no local ID');
    }

    try {
      await db.products.update(product.id, {
        syncStatus: SyncStatus.SYNCED,
        lastSyncAt: new Date(),
        localId: data.id,
        updatedAt: new Date(),
      });
      logInfo('Local product updated', 'syncProduct', { sku: product.sku, localId: product.id });
    } catch (dbError) {
      const errMsg = dbError instanceof Error ? dbError.message : 'Unknown DB error';
      logError('Failed to update local product', dbError as Error, 'syncProduct', { sku: product.sku });
      throw new Error(`Local DB error: ${errMsg}`);
    }
    
    logInfo('Product synced successfully', 'syncProduct', { sku: product.sku, localId: data.id });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error in syncProduct';
    logError('syncProduct failed', error as Error, 'syncProduct', { sku: product.sku });
    throw new Error(`syncProduct failed: ${errMsg}`);
  }
}

// Sync a single sale to Supabase
async function syncSale(sale: Sale): Promise<void> {
  logInfo('Syncing sale', 'syncSale', { saleId: sale.id, total: sale.totalAmountUsd, localId: sale.localId });
  
  // Check if already synced (has localId)
  if (sale.localId) {
    logInfo('Sale already synced, skipping', 'syncSale', { saleId: sale.id, localId: sale.localId });
    
    // Update sync status and timestamp even if already synced
    await db.sales.update(sale.id!, {
      syncStatus: SyncStatus.SYNCED,
      lastSyncAt: new Date(),
      updatedAt: new Date(),
    });
    
    return;
  }
  
  // Get sale items
  const items = await db.saleItems.where('saleId').equals(sale.id!).toArray();
  logInfo(`Found ${items.length} items for sale`, 'syncSale', { saleId: sale.id });
  
  // First sync the sale
  const { data: saleData, error: saleError } = await supabase
    .from('sales')
    .insert({
      subtotal_usd: sale.subtotalUsd,
      iva_amount_usd: sale.ivaAmountUsd,
      igtf_amount_usd: sale.igtfAmountUsd,
      total_amount_usd: sale.totalAmountUsd,
      exchange_rate_ves: sale.exchangeRateVes,
      total_amount_ves: sale.totalAmountVes,
    })
    .select()
    .single();

  if (saleError) {
    logError('Failed to insert sale', saleError, 'syncSale', { saleId: sale.id });
    throw saleError;
  }
  
  logInfo('Sale inserted to Supabase', 'syncSale', { saleId: sale.id, supabaseId: saleData.id });

  // Then sync the items - need to get Supabase product IDs
  const saleItemsData = [];
  for (const item of items) {
    // item.productId is the SKU, we need to find the Supabase product ID
    const localProduct = await db.products.where('sku').equals(item.productId).first();
    if (!localProduct) {
      throw new Error(`Product not found locally: ${item.productId}`);
    }
    
    // Use localId if available (Supabase ID), otherwise we need to find it
    let supabaseProductId = localProduct.localId;
    if (!supabaseProductId) {
      // Look up in Supabase by SKU
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('id')
        .eq('sku', item.productId)
        .single();
      
      if (productError || !productData) {
        throw new Error(`Product ${item.productId} not found in Supabase`);
      }
      supabaseProductId = productData.id;
    }
    
    saleItemsData.push({
      sale_id: saleData.id,
      product_id: supabaseProductId,
      quantity: item.quantity,
      price_per_unit_usd: item.pricePerUnitUsd,
    });
  }

  const { error: itemsError } = await supabase
    .from('sale_items')
    .insert(saleItemsData);

  if (itemsError) {
    logError('Failed to insert sale items', itemsError, 'syncSale', { saleId: sale.id });
    throw itemsError;
  }
  
  logInfo('Sale items inserted', 'syncSale', { saleId: sale.id, itemCount: saleItemsData.length });

  // Update local records using transaction
  await db.transaction('rw', [db.sales, db.saleItems], async () => {
    // Update sale
    await db.sales.update(sale.id!, {
      syncStatus: SyncStatus.SYNCED,
      lastSyncAt: new Date(),
      localId: saleData.id,
      updatedAt: new Date(),
    });

    // Update items
    for (const item of items) {
      await db.saleItems.update(item.id!, {
        syncStatus: SyncStatus.SYNCED,
        lastSyncAt: new Date(),
        localId: saleData.id,
        updatedAt: new Date(),
      });
    }
  });
  
  logInfo('Sale synced successfully', 'syncSale', { saleId: sale.id, supabaseId: saleData.id });
}

// Main sync function
export async function syncPendingData(): Promise<{
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}> {
  if (!isOnline()) {
    logWarn('Sync attempted while offline', 'syncPendingData');
    return {
      success: false,
      synced: 0,
      failed: 0,
      errors: ['Device is offline'],
    };
  }

  syncEvents.emit('sync-start');
  logInfo('Starting sync', 'syncPendingData');

  const errors: string[] = [];
  let synced = 0;
  let failed = 0;

  try {
    // Sync products
    const pendingProducts = await db.products
      .where('syncStatus')
      .equals(SyncStatus.PENDING)
      .toArray();

    logInfo('Found pending products', 'syncPendingData', { count: pendingProducts.length });

    for (const product of pendingProducts) {
      try {
        await syncProduct(product);
        synced++;
      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Product ${product.sku}: ${errorMsg}`);
        await db.products.update(product.id!, {
          syncStatus: SyncStatus.ERROR,
          syncError: errorMsg,
          updatedAt: new Date(),
        });
      }
    }

    // Sync sales
    const pendingSales = await db.sales
      .where('syncStatus')
      .equals(SyncStatus.PENDING)
      .toArray();

    logInfo('Found pending sales', 'syncPendingData', { count: pendingSales.length });

    for (const sale of pendingSales) {
      try {
        await syncSale(sale);
        synced++;
      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Sale ${sale.id}: ${errorMsg}`);
        await db.sales.update(sale.id!, {
          syncStatus: SyncStatus.ERROR,
          syncError: errorMsg,
          updatedAt: new Date(),
        });
      }
    }

    syncEvents.emit('sync-complete', { synced, failed, errors });
    
    if (failed === 0) {
      logInfo('Sync completed successfully', 'syncPendingData', { synced });
    } else {
      logWarn('Sync completed with errors', 'syncPendingData', { synced, failed, errorCount: errors.length });
    }

    return {
      success: failed === 0,
      synced,
      failed,
      errors,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logError('Sync failed', error instanceof Error ? error : new Error(errorMsg), 'syncPendingData');
    syncEvents.emit('sync-error', errorMsg);
    return {
      success: false,
      synced,
      failed,
      errors: [...errors, errorMsg],
    };
  }
}

// Get sync statistics
export async function getSyncStats(): Promise<{
  pendingProducts: number;
  pendingSales: number;
  totalPending: number;
  lastSync: Date | null;
}> {
  try {
    const pendingProducts = await db.products
      .where('syncStatus')
      .equals(SyncStatus.PENDING)
      .count();

    const pendingSales = await db.sales
      .where('syncStatus')
      .equals(SyncStatus.PENDING)
      .count();

    // Buscar la última venta sincronizada
    let lastSync: Date | null = null;
    try {
      const syncedSales = await db.sales
        .where('syncStatus')
        .equals(SyncStatus.SYNCED)
        .toArray();
      
      if (syncedSales.length > 0) {
        // Encontrar la más reciente por lastSyncAt
        const lastSynced = syncedSales
          .filter(s => s.lastSyncAt)
          .sort((a, b) => (b.lastSyncAt?.getTime() || 0) - (a.lastSyncAt?.getTime() || 0))[0];
        lastSync = lastSynced?.lastSyncAt || null;
      }
    } catch (e) {
      logWarn('Could not get last sync date', 'getSyncStats');
    }

    return {
      pendingProducts,
      pendingSales,
      totalPending: pendingProducts + pendingSales,
      lastSync,
    };
  } catch (error) {
    logError('Error getting sync stats', error as Error, 'getSyncStats');
    return {
      pendingProducts: 0,
      pendingSales: 0,
      totalPending: 0,
      lastSync: null,
    };
  }
}

// Fetch products from Supabase and update local DB
export async function fetchProductsFromCloud(): Promise<number> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  if (!data) return 0;

  logInfo(`Downloaded ${data.length} products from cloud`, 'fetchProductsFromCloud');
  
  // Estrategia segura: Limpiar tabla completamente y reinsertar
  try {
    logInfo('Starting database transaction', 'fetchProductsFromCloud');
    
    // Limpiar tabla completamente
    try {
      await db.products.clear();
      logInfo('Cleared local products table', 'fetchProductsFromCloud');
    } catch (clearError) {
      const errMsg = clearError instanceof Error ? clearError.message : 'Unknown clear error';
      const errStack = clearError instanceof Error ? clearError.stack : 'No stack';
      logError('Error clearing table', clearError as Error, 'fetchProductsFromCloud');
      console.error('Clear error details:', clearError);
      throw new Error(`Failed to clear table: ${errMsg}. Stack: ${errStack}`);
    }
    
    // Insertar productos uno por uno para mejor manejo de errores
    let inserted = 0;
    let failed = 0;
    
    for (let i = 0; i < data.length; i++) {
      const productData = data[i];
      try {
        const productToInsert = {
          sku: productData.sku,
          name: productData.name,
          description: productData.description,
          costUsd: productData.cost_usd,
          priceUsd: productData.price_usd,
          stockQuantity: productData.stock_quantity,
          minStockAlert: productData.min_stock_alert || 5,
          supplier: productData.supplier,
          syncStatus: SyncStatus.SYNCED,
          lastSyncAt: new Date(),
          createdAt: new Date(productData.created_at || Date.now()),
          updatedAt: new Date(productData.updated_at || Date.now()),
        };
        
        await db.products.add(productToInsert);
        inserted++;
        
        // Log cada 10 productos
        if (inserted % 10 === 0) {
          logInfo(`Inserted ${inserted}/${data.length} products...`, 'fetchProductsFromCloud');
        }
      } catch (itemError) {
        failed++;
        const errMsg = itemError instanceof Error ? itemError.message : 'Unknown error';
        logError(`Error inserting product ${productData.sku} (${i + 1}/${data.length}): ${errMsg}`, itemError as Error, 'fetchProductsFromCloud');
        console.error(`Full error for ${productData.sku}:`, itemError);
        
        // Si fallan muchos, detener
        if (failed > 5) {
          throw new Error(`Too many insert failures (${failed}). Last error: ${errMsg}`);
        }
      }
    }
    
    logInfo(`Inserted ${inserted} products locally (${failed} failed)`, 'fetchProductsFromCloud');
    return inserted;
  } catch (dbError) {
    const errMsg = dbError instanceof Error ? dbError.message : 'Unknown DB error';
    const errStack = dbError instanceof Error ? dbError.stack : 'No stack trace';
    logError('Error updating local database', dbError as Error, 'fetchProductsFromCloud');
    console.error('Full DB error:', dbError);
    console.error('Stack:', errStack);
    throw new Error(`Database update failed: ${errMsg}. Stack: ${errStack}`);
  }
}

// Full sync (bidirectional)
export async function fullSync(): Promise<{
  success: boolean;
  uploaded: number;
  downloaded: number;
  errors: string[];
}> {
  syncEvents.emit('full-sync-start');

  const errors: string[] = [];

  try {
    // First upload pending local data
    const uploadResult = await syncPendingData();
    
    if (!uploadResult.success) {
      errors.push(...uploadResult.errors);
    }

    // Then download from cloud
    const downloaded = await fetchProductsFromCloud();

    syncEvents.emit('full-sync-complete', { 
      uploaded: uploadResult.synced, 
      downloaded,
      errors 
    });

    return {
      success: errors.length === 0,
      uploaded: uploadResult.synced,
      downloaded,
      errors,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    syncEvents.emit('full-sync-error', errorMsg);
    return {
      success: false,
      uploaded: 0,
      downloaded: 0,
      errors: [errorMsg],
    };
  }
}

// Detect potential duplicate sales in Supabase
export async function detectDuplicateSales(): Promise<{
  duplicates: Array<{ id: string; total: number; created_at: string }>;
  totalSales: number;
}> {
  logInfo('Detecting duplicate sales in Supabase', 'detectDuplicateSales');
  
  try {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    if (!data) return { duplicates: [], totalSales: 0 };
    
    // Group by similar properties to find potential duplicates
    const groups = new Map<string, any[]>();
    
    data.forEach((sale: any) => {
      // Create a key based on total amount, exchange rate, and rounded timestamp (by hour)
      const date = new Date(sale.created_at);
      const hourKey = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours());
      const key = `${sale.total_amount_usd}-${sale.exchange_rate_ves}-${hourKey.toISOString()}`;
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(sale);
    });
    
    // Find groups with more than 1 sale
    const duplicates: Array<{ id: string; total: number; created_at: string }> = [];
    groups.forEach((sales) => {
      if (sales.length > 1) {
        sales.forEach((sale) => {
          duplicates.push({
            id: sale.id,
            total: sale.total_amount_usd,
            created_at: sale.created_at,
          });
        });
      }
    });
    
    logInfo('Duplicate detection completed', 'detectDuplicateSales', {
      totalSales: data.length,
      duplicatesFound: duplicates.length,
    });
    
    return {
      duplicates,
      totalSales: data.length,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    logError('Failed to detect duplicates', error as Error, 'detectDuplicateSales');
    throw new Error(`Duplicate detection failed: ${errMsg}`);
  }
}

// Get detailed sync status for diagnostics
export async function getDetailedSyncStatus(): Promise<{
  local: {
    products: { total: number; synced: number; pending: number; error: number };
    sales: { total: number; synced: number; pending: number; error: number };
  };
  cloud: {
    products: number;
    sales: number;
  };
  duplicates: {
    sales: Array<{ id: string; total: number; created_at: string }>;
  };
}> {
  logInfo('Getting detailed sync status', 'getDetailedSyncStatus');
  
  try {
    // Local stats
    const [localProducts, localSales] = await Promise.all([
      db.products.toArray(),
      db.sales.toArray(),
    ]);
    
    const localStats = {
      products: {
        total: localProducts.length,
        synced: localProducts.filter(p => p.syncStatus === SyncStatus.SYNCED).length,
        pending: localProducts.filter(p => p.syncStatus === SyncStatus.PENDING).length,
        error: localProducts.filter(p => p.syncStatus === SyncStatus.ERROR).length,
      },
      sales: {
        total: localSales.length,
        synced: localSales.filter(s => s.syncStatus === SyncStatus.SYNCED).length,
        pending: localSales.filter(s => s.syncStatus === SyncStatus.PENDING).length,
        error: localSales.filter(s => s.syncStatus === SyncStatus.ERROR).length,
      },
    };
    
    // Cloud stats
    const [productsResult, salesResult] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase.from('sales').select('*', { count: 'exact', head: true }),
    ]);
    
    const cloudStats = {
      products: productsResult.count || 0,
      sales: salesResult.count || 0,
    };
    
    // Check for duplicates
    const duplicateInfo = await detectDuplicateSales();
    
    return {
      local: localStats,
      cloud: cloudStats,
      duplicates: {
        sales: duplicateInfo.duplicates,
      },
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    logError('Failed to get detailed sync status', error as Error, 'getDetailedSyncStatus');
    throw new Error(`Failed to get detailed status: ${errMsg}`);
  }
}

// Initialize sync on app load
export function initializeSync() {
  if (typeof window === 'undefined') return;

  logInfo('Initializing sync service', 'initializeSync');
  
  setupNetworkListeners();

  // Auto-sync when app loads if online
  if (isOnline()) {
    logInfo('Auto-syncing on app load', 'initializeSync');
    syncPendingData().catch((err) => {
      logError('Auto-sync failed on app load', err, 'initializeSync');
    });
  } else {
    logWarn('App started offline, skipping auto-sync', 'initializeSync');
  }
}

// Función de sincronización bidireccional completa
export async function bidirectionalSync(): Promise<{
  success: boolean;
  uploaded: number;
  downloaded: number;
  errors: string[];
}> {
  syncEvents.emit('sync-start');
  logInfo('Starting bidirectional sync', 'bidirectionalSync');

  const errors: string[] = [];
  let uploaded = 0;
  let downloaded = 0;

  try {
    // 1. Verificar que IndexedDB está accesible
    logInfo('Checking IndexedDB connection', 'bidirectionalSync');
    try {
      const testCount = await db.products.count();
      logInfo(`IndexedDB accessible: ${testCount} products locally`, 'bidirectionalSync');
    } catch (dbError) {
      const errMsg = dbError instanceof Error ? dbError.message : 'IndexedDB not accessible';
      const errStack = dbError instanceof Error ? dbError.stack : 'No stack trace';
      logError('IndexedDB error', dbError as Error, 'bidirectionalSync');
      console.error('Full IndexedDB error:', dbError);
      console.error('Stack trace:', errStack);
      throw new Error(`Database error: ${errMsg}. Stack: ${errStack}`);
    }

    // 2. Subir datos locales pendientes
    logInfo('Uploading pending local data', 'bidirectionalSync');
    let uploadResult;
    try {
      uploadResult = await syncPendingData();
    } catch (uploadError) {
      const errMsg = uploadError instanceof Error ? uploadError.message : 'Upload failed';
      const errStack = uploadError instanceof Error ? uploadError.stack : 'No stack';
      logError('Upload failed', uploadError as Error, 'bidirectionalSync');
      errors.push(`Upload error: ${errMsg}`);
      throw new Error(`Upload failed: ${errMsg}. Stack: ${errStack}`);
    }
    
    if (!uploadResult.success) {
      errors.push(...uploadResult.errors);
    }
    uploaded = uploadResult.synced;

    // 2. Descargar datos nuevos de la nube
    logInfo('Fetching data from cloud', 'bidirectionalSync');
    try {
      downloaded = await fetchProductsFromCloud();
      logInfo('Download completed', 'bidirectionalSync', { downloaded });
    } catch (downloadError) {
      const errorMsg = downloadError instanceof Error ? downloadError.message : 'Download failed';
      errors.push(errorMsg);
    }

    syncEvents.emit('sync-complete', { uploaded, downloaded, errors });

    return {
      success: errors.length === 0,
      uploaded,
      downloaded,
      errors,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    syncEvents.emit('sync-error', errorMsg);
    return {
      success: false,
      uploaded,
      downloaded,
      errors: [...errors, errorMsg],
    };
  }
}

export default {
  syncPendingData,
  fullSync,
  bidirectionalSync,
  getSyncStats,
  detectDuplicateSales,
  getDetailedSyncStatus,
  isOnline,
  setupNetworkListeners,
  initializeSync,
  syncEvents,
};
