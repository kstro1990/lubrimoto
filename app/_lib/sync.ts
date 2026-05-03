import type { Table } from 'dexie';
import { supabase } from './supabase';
import db, { SyncStatus, Syncable, Product, Sale, SaleItem, Customer, Payment } from '../_db/db';
import { logInfo, logError, logWarn } from './logger';

// Ensure a Syncable record has a client-generated UUID to use as the Supabase
// `local_uuid` idempotency key. Persists the UUID synchronously so that a
// crash between generate and insert still lets the next retry collapse onto
// the same remote row instead of creating a duplicate.
async function ensureSyncUuid<T extends Syncable>(table: Table<T>, record: T): Promise<string> {
  if (record.syncUuid) return record.syncUuid;
  const uuid = crypto.randomUUID();
  record.syncUuid = uuid;
  if (record.id !== undefined) {
    // Dexie's UpdateSpec is a mapped type over T; TS can't narrow it through
    // the generic bound, so assert the single-field patch explicitly.
    await table.update(record.id as number, { syncUuid: uuid } as unknown as Parameters<typeof table.update>[1]);
  }
  return uuid;
}

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

// Transform local customer to Supabase format
function transformCustomerToSupabase(customer: Customer): Record<string, unknown> {
  return {
    name: customer.name,
    email: customer.email || null,
    phone: customer.phone || null,
    address: customer.address || null,
  };
}

// Transform Supabase customer to local format
function transformCustomerFromSupabase(data: Record<string, unknown>): Omit<Customer, 'id'> {
  return {
    localId: data.id as string,
    name: data.name as string,
    email: (data.email as string) || undefined,
    phone: (data.phone as string) || undefined,
    address: (data.address as string) || undefined,
    syncStatus: SyncStatus.SYNCED,
    lastSyncAt: new Date(),
    createdAt: new Date((data.created_at as string) || Date.now()),
    updatedAt: new Date((data.updated_at as string) || Date.now()),
  };
}

// Sync a single customer to Supabase using UPSERT on `local_uuid` for idempotency.
async function syncCustomer(customer: Customer): Promise<void> {
  if (customer.id === undefined) {
    throw new Error('syncCustomer called without a local id');
  }

  logInfo('Syncing customer', 'syncCustomer', { name: customer.name, id: customer.id });

  const syncUuid = await ensureSyncUuid(db.customers, customer);

  const { data, error } = await supabase
    .from('customers')
    .upsert(
      { local_uuid: syncUuid, ...transformCustomerToSupabase(customer) },
      { onConflict: 'local_uuid' }
    )
    .select('id')
    .single();

  if (error || !data) {
    const msg = error?.message || 'No data returned from Supabase';
    logError('Failed to upsert customer', error as Error, 'syncCustomer', { name: customer.name });
    throw new Error(`Supabase customer upsert failed: ${msg}`);
  }

  await db.customers.update(customer.id, {
    localId: data.id,
    syncStatus: SyncStatus.SYNCED,
    lastSyncAt: new Date(),
    updatedAt: new Date(),
  });

  logInfo('Customer synced', 'syncCustomer', { name: customer.name, supabaseId: data.id });
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

// Resolve the Supabase product UUID for a sale item, syncing the product first
// if needed. Throws if the product is missing locally or cannot be synced —
// this prevents the previous silent-skip behaviour that produced cloud sales
// with missing line items.
async function resolveProductSupabaseId(sku: string): Promise<string> {
  const local = await db.products.where('sku').equals(sku).first();
  if (!local) {
    throw new Error(`Product not found locally: ${sku}`);
  }
  if (local.localId) return local.localId;

  await syncProduct(local);
  const refreshed = await db.products.where('sku').equals(sku).first();
  if (!refreshed?.localId) {
    throw new Error(`Could not resolve Supabase id for product ${sku} after sync`);
  }
  return refreshed.localId;
}

// Sync a single sale to Supabase.
//
// Guarantees:
// - Idempotent: a retry after any partial failure upserts onto the same
//   remote rows (keyed by `local_uuid`), never duplicates.
// - All-or-nothing: pre-validates that every referenced product and customer
//   can be synced before touching the sale; items and payments failures throw
//   instead of silently dropping data.
async function syncSale(sale: Sale): Promise<void> {
  if (sale.id === undefined) {
    throw new Error('syncSale called without a local id');
  }

  logInfo('Syncing sale', 'syncSale', { saleId: sale.id, total: sale.totalAmountUsd });

  const saleUuid = await ensureSyncUuid(db.sales, sale);
  const items = await db.saleItems.where('saleId').equals(sale.id).toArray();
  const payments = await db.payments.where('saleId').equals(sale.id).toArray();

  // 1. Pre-validate every referenced product (throws if any cannot be synced).
  const productIdBySku = new Map<string, string>();
  for (const item of items) {
    if (!productIdBySku.has(item.productId)) {
      productIdBySku.set(item.productId, await resolveProductSupabaseId(item.productId));
    }
  }

  // 2. Sync customer if attached (throws on failure rather than dropping the link).
  let customerSupabaseId: string | null = null;
  if (sale.customerId !== undefined) {
    const customer = await db.customers.get(sale.customerId);
    if (!customer) {
      throw new Error(`Customer not found locally: ${sale.customerId}`);
    }
    if (!customer.localId) {
      await syncCustomer(customer);
      const refreshed = await db.customers.get(sale.customerId);
      customerSupabaseId = refreshed?.localId ?? null;
      if (!customerSupabaseId) {
        throw new Error(`Could not resolve Supabase id for customer ${sale.customerId}`);
      }
    } else {
      customerSupabaseId = customer.localId;
    }
  }

  // 3. Assign syncUuids to every item and payment so subsequent retries stay idempotent.
  for (const item of items) await ensureSyncUuid(db.saleItems, item);
  for (const payment of payments) await ensureSyncUuid(db.payments, payment);

  // 4. UPSERT sale.
  const { data: saleData, error: saleError } = await supabase
    .from('sales')
    .upsert(
      {
        local_uuid: saleUuid,
        customer_id: customerSupabaseId,
        subtotal_usd: sale.subtotalUsd,
        iva_amount_usd: sale.ivaAmountUsd,
        igtf_amount_usd: sale.igtfAmountUsd,
        total_amount_usd: sale.totalAmountUsd,
        exchange_rate_ves: sale.exchangeRateVes,
        total_amount_ves: sale.totalAmountVes,
        sale_date: sale.date.toISOString(),
      },
      { onConflict: 'local_uuid' }
    )
    .select('id')
    .single();

  if (saleError || !saleData) {
    const msg = saleError?.message || 'No data returned from Supabase';
    logError('Failed to upsert sale', saleError as Error, 'syncSale', { saleId: sale.id });
    throw new Error(`Supabase sale upsert failed: ${msg}`);
  }

  // Persist the Supabase id in SYNCING state immediately so a crash between
  // now and the final update still lets the next retry find the remote row.
  await db.sales.update(sale.id, {
    localId: saleData.id,
    syncStatus: SyncStatus.SYNCING,
    lastSyncAt: new Date(),
    updatedAt: new Date(),
  });

  // 5. UPSERT items.
  if (items.length > 0) {
    const itemsPayload = items.map((item) => ({
      local_uuid: item.syncUuid,
      sale_id: saleData.id,
      product_id: productIdBySku.get(item.productId)!,
      quantity: item.quantity,
      price_per_unit_usd: item.pricePerUnitUsd,
    }));

    const { data: itemsData, error: itemsError } = await supabase
      .from('sale_items')
      .upsert(itemsPayload, { onConflict: 'local_uuid' })
      .select('id, local_uuid');

    if (itemsError || !itemsData) {
      const msg = itemsError?.message || 'No data returned from Supabase';
      logError('Failed to upsert sale items', itemsError as Error, 'syncSale', { saleId: sale.id });
      throw new Error(`Supabase sale_items upsert failed: ${msg}`);
    }

    const itemIdByUuid = new Map(itemsData.map((r) => [r.local_uuid as string, r.id as string]));
    for (const item of items) {
      if (item.id === undefined) continue;
      await db.saleItems.update(item.id, {
        localId: itemIdByUuid.get(item.syncUuid!) ?? item.localId,
        syncStatus: SyncStatus.SYNCED,
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  // 6. UPSERT payments.
  if (payments.length > 0) {
    const paymentsPayload = payments.map((p) => ({
      local_uuid: p.syncUuid,
      sale_id: saleData.id,
      method: p.method,
      amount: p.amount,
      reference_code: p.referenceCode || null,
    }));

    const { data: paymentsData, error: paymentsError } = await supabase
      .from('payments')
      .upsert(paymentsPayload, { onConflict: 'local_uuid' })
      .select('id, local_uuid');

    if (paymentsError || !paymentsData) {
      const msg = paymentsError?.message || 'No data returned from Supabase';
      logError('Failed to upsert payments', paymentsError as Error, 'syncSale', { saleId: sale.id });
      throw new Error(`Supabase payments upsert failed: ${msg}`);
    }

    const paymentIdByUuid = new Map(paymentsData.map((r) => [r.local_uuid as string, r.id as string]));
    for (const payment of payments) {
      if (payment.id === undefined) continue;
      await db.payments.update(payment.id, {
        localId: paymentIdByUuid.get(payment.syncUuid!) ?? payment.localId,
        syncStatus: SyncStatus.SYNCED,
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  // 7. Mark the sale fully synced only after items and payments succeed.
  await db.sales.update(sale.id, {
    syncStatus: SyncStatus.SYNCED,
    lastSyncAt: new Date(),
    updatedAt: new Date(),
  });

  logInfo('Sale synced', 'syncSale', { saleId: sale.id, supabaseId: saleData.id });
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

    // Sync customers (before sales, so customer_id is available)
    const pendingCustomers = await db.customers
      .where('syncStatus')
      .equals(SyncStatus.PENDING)
      .toArray();

    logInfo('Found pending customers', 'syncPendingData', { count: pendingCustomers.length });

    for (const customer of pendingCustomers) {
      try {
        await syncCustomer(customer);
        synced++;
      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Customer ${customer.name}: ${errorMsg}`);
        if (customer.id) {
          await db.customers.update(customer.id, {
            syncStatus: SyncStatus.ERROR,
            syncError: errorMsg,
            updatedAt: new Date(),
          });
        }
      }
    }

    // Sync sales. Include SYNCING so we finish sales interrupted mid-sync by
    // a crash or page reload (the UPSERT on local_uuid is idempotent).
    const pendingSales = await db.sales
      .where('syncStatus')
      .anyOf(SyncStatus.PENDING, SyncStatus.SYNCING)
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
  pendingCustomers: number;
  pendingSales: number;
  totalPending: number;
  lastSync: Date | null;
}> {
  try {
    const pendingProducts = await db.products
      .where('syncStatus')
      .equals(SyncStatus.PENDING)
      .count();

    const pendingCustomers = await db.customers
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
      pendingCustomers,
      pendingSales,
      totalPending: pendingProducts + pendingCustomers + pendingSales,
      lastSync,
    };
  } catch (error) {
    logError('Error getting sync stats', error as Error, 'getSyncStats');
    return {
      pendingProducts: 0,
      pendingCustomers: 0,
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

// Pull customers from Supabase. Idempotent: skips remote rows whose
// `local_uuid` already matches a local customer's `syncUuid`. Local
// records are not modified — pending edits stay pending.
export async function fetchCustomersFromCloud(): Promise<number> {
  const { data, error } = await supabase.from('customers').select('*');
  if (error) throw new Error(`fetchCustomersFromCloud failed: ${error.message}`);
  if (!data) return 0;

  const localBySyncUuid = new Map<string, true>();
  for (const c of await db.customers.toArray()) {
    if (c.syncUuid) localBySyncUuid.set(c.syncUuid, true);
  }

  let inserted = 0;
  for (const remote of data) {
    if (remote.local_uuid && localBySyncUuid.has(remote.local_uuid)) continue;
    await db.customers.add({
      name: remote.name,
      email: remote.email || undefined,
      phone: remote.phone || undefined,
      address: remote.address || undefined,
      localId: remote.id,
      syncUuid: remote.local_uuid || crypto.randomUUID(),
      syncStatus: SyncStatus.SYNCED,
      lastSyncAt: new Date(),
      createdAt: new Date(remote.created_at || Date.now()),
      updatedAt: new Date(remote.updated_at || Date.now()),
    });
    inserted++;
  }
  logInfo(`Inserted ${inserted} customers from cloud`, 'fetchCustomersFromCloud');
  return inserted;
}

// Pull sales from Supabase along with their items and payments.
// Idempotent by `syncUuid`. Resolves remote UUIDs to local refs:
// `customer_id` → local customer numeric id, `product_id` → local SKU.
// Items pointing to a product not present locally are skipped (the
// product fetch should run first).
export async function fetchSalesFromCloud(): Promise<number> {
  const { data: sales, error } = await supabase
    .from('sales')
    .select('*')
    .order('sale_date', { ascending: true, nullsFirst: true });
  if (error) throw new Error(`fetchSalesFromCloud failed: ${error.message}`);
  if (!sales) return 0;

  // Build remote-id → local-id maps once so we don't query per row.
  const customerIdByLocalId = new Map<string, number>();
  for (const c of await db.customers.toArray()) {
    if (c.localId && c.id !== undefined) customerIdByLocalId.set(c.localId, c.id);
  }
  const productSkuByLocalId = new Map<string, string>();
  for (const p of await db.products.toArray()) {
    if (p.localId) productSkuByLocalId.set(p.localId, p.sku);
  }
  const localSaleSyncUuids = new Set(
    (await db.sales.toArray()).map((s) => s.syncUuid).filter((u): u is string => !!u)
  );

  let inserted = 0;
  for (const remote of sales) {
    if (remote.local_uuid && localSaleSyncUuids.has(remote.local_uuid)) continue;

    const localSaleId = await db.sales.add({
      customerId: remote.customer_id ? customerIdByLocalId.get(remote.customer_id) : undefined,
      subtotalUsd: Number(remote.subtotal_usd),
      ivaAmountUsd: Number(remote.iva_amount_usd),
      igtfAmountUsd: Number(remote.igtf_amount_usd),
      totalAmountUsd: Number(remote.total_amount_usd),
      exchangeRateVes: Number(remote.exchange_rate_ves),
      totalAmountVes: Number(remote.total_amount_ves),
      date: new Date(remote.sale_date || remote.created_at || Date.now()),
      localId: remote.id,
      syncUuid: remote.local_uuid || crypto.randomUUID(),
      syncStatus: SyncStatus.SYNCED,
      lastSyncAt: new Date(),
      createdAt: new Date(remote.created_at || Date.now()),
      updatedAt: new Date(remote.created_at || Date.now()),
    });

    const { data: items } = await supabase.from('sale_items').select('*').eq('sale_id', remote.id);
    for (const item of items ?? []) {
      const sku = productSkuByLocalId.get(item.product_id);
      if (!sku) {
        logWarn('Skipping item — product not in local DB', 'fetchSalesFromCloud', { saleId: remote.id, productId: item.product_id });
        continue;
      }
      await db.saleItems.add({
        saleId: localSaleId,
        productId: sku,
        quantity: item.quantity,
        pricePerUnitUsd: Number(item.price_per_unit_usd),
        localId: item.id,
        syncUuid: item.local_uuid || crypto.randomUUID(),
        syncStatus: SyncStatus.SYNCED,
        lastSyncAt: new Date(),
        createdAt: new Date(remote.created_at || Date.now()),
        updatedAt: new Date(remote.created_at || Date.now()),
      });
    }

    const { data: payments } = await supabase.from('payments').select('*').eq('sale_id', remote.id);
    for (const p of payments ?? []) {
      await db.payments.add({
        saleId: localSaleId,
        method: p.method,
        amount: Number(p.amount),
        referenceCode: p.reference_code || undefined,
        localId: p.id,
        syncUuid: p.local_uuid || crypto.randomUUID(),
        syncStatus: SyncStatus.SYNCED,
        lastSyncAt: new Date(),
        createdAt: new Date(remote.created_at || Date.now()),
        updatedAt: new Date(remote.created_at || Date.now()),
      });
    }

    inserted++;
  }
  logInfo(`Inserted ${inserted} sales from cloud`, 'fetchSalesFromCloud');
  return inserted;
}

// Pull inventory movements from Supabase. Movements have no `local_uuid`
// for idempotency, so we follow the same clear+reinsert pattern as
// products. Movements whose product no longer exists locally are skipped.
export async function fetchInventoryMovementsFromCloud(): Promise<number> {
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw new Error(`fetchInventoryMovementsFromCloud failed: ${error.message}`);
  if (!data) return 0;

  const productIdByLocalId = new Map<string, number>();
  for (const p of await db.products.toArray()) {
    if (p.localId && p.id !== undefined) productIdByLocalId.set(p.localId, p.id);
  }

  await db.inventoryMovements.clear();

  let inserted = 0;
  for (const m of data) {
    const localProductId = productIdByLocalId.get(m.product_id);
    if (localProductId === undefined) continue;
    await db.inventoryMovements.add({
      productId: localProductId,
      productSku: m.product_sku,
      productName: m.product_name,
      type: m.type,
      quantity: m.quantity,
      previousStock: m.previous_stock,
      newStock: m.new_stock,
      notes: m.notes || undefined,
      createdBy: m.created_by || undefined,
      createdAt: new Date(m.created_at || Date.now()),
    });
    inserted++;
  }
  logInfo(`Inserted ${inserted} inventory movements from cloud`, 'fetchInventoryMovementsFromCloud');
  return inserted;
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
    customers: { total: number; synced: number; pending: number; error: number };
    sales: { total: number; synced: number; pending: number; error: number };
  };
  cloud: {
    products: number;
    customers: number;
    sales: number;
  };
  duplicates: {
    sales: Array<{ id: string; total: number; created_at: string }>;
  };
}> {
  logInfo('Getting detailed sync status', 'getDetailedSyncStatus');
  
  try {
    // Local stats
    const [localProducts, localCustomers, localSales] = await Promise.all([
      db.products.toArray(),
      db.customers.toArray(),
      db.sales.toArray(),
    ]);

    const localStats = {
      products: {
        total: localProducts.length,
        synced: localProducts.filter(p => p.syncStatus === SyncStatus.SYNCED).length,
        pending: localProducts.filter(p => p.syncStatus === SyncStatus.PENDING).length,
        error: localProducts.filter(p => p.syncStatus === SyncStatus.ERROR).length,
      },
      customers: {
        total: localCustomers.length,
        synced: localCustomers.filter(c => c.syncStatus === SyncStatus.SYNCED).length,
        pending: localCustomers.filter(c => c.syncStatus === SyncStatus.PENDING).length,
        error: localCustomers.filter(c => c.syncStatus === SyncStatus.ERROR).length,
      },
      sales: {
        total: localSales.length,
        synced: localSales.filter(s => s.syncStatus === SyncStatus.SYNCED).length,
        pending: localSales.filter(s => s.syncStatus === SyncStatus.PENDING).length,
        error: localSales.filter(s => s.syncStatus === SyncStatus.ERROR).length,
      },
    };

    // Cloud stats
    const [productsResult, customersResult, salesResult] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase.from('customers').select('*', { count: 'exact', head: true }),
      supabase.from('sales').select('*', { count: 'exact', head: true }),
    ]);

    const cloudStats = {
      products: productsResult.count || 0,
      customers: customersResult.count || 0,
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

    // 2. Descargar datos nuevos de la nube. Order matters: products and
    // customers must land first because sales/items reference them.
    logInfo('Fetching data from cloud', 'bidirectionalSync');
    try {
      const products = await fetchProductsFromCloud();
      const customers = await fetchCustomersFromCloud();
      const sales = await fetchSalesFromCloud();
      const movements = await fetchInventoryMovementsFromCloud();
      downloaded = products + customers + sales + movements;
      logInfo('Download completed', 'bidirectionalSync', { products, customers, sales, movements });
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
