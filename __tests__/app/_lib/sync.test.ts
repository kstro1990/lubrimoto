/**
 * Tests for the sync engine. The supabase client and Dexie tables are mocked
 * so each test can stub specific responses (success, error, conflict) and
 * assert what was sent to the network and what landed in IndexedDB.
 */

import { SyncStatus } from '@/app/_db/db';

// --- Supabase mock ---------------------------------------------------------
// `from(table).upsert(...).select(...).single()` returns the value queued
// for that table on this pending call.
type SupabaseResponse = { data: any; error: any };
const supabaseQueue: Record<string, SupabaseResponse[]> = {};
const supabaseCalls: Array<{ table: string; method: string; payload: any; options?: any }> = [];

function makeBuilder(table: string) {
  const builder: any = {
    _table: table,
    _lastMethod: '',
    upsert(payload: any, options?: any) {
      supabaseCalls.push({ table, method: 'upsert', payload, options });
      builder._lastMethod = 'upsert';
      return builder;
    },
    insert(payload: any) {
      supabaseCalls.push({ table, method: 'insert', payload });
      builder._lastMethod = 'insert';
      return builder;
    },
    update(payload: any) {
      supabaseCalls.push({ table, method: 'update', payload });
      builder._lastMethod = 'update';
      return builder;
    },
    select(_cols?: string) {
      return builder;
    },
    eq() {
      return builder;
    },
    ilike() {
      return builder;
    },
    maybeSingle() {
      return Promise.resolve(nextResponse(table));
    },
    single() {
      return Promise.resolve(nextResponse(table));
    },
    order() {
      return Promise.resolve(nextResponse(table));
    },
    then(onFulfilled: any, onRejected: any) {
      // Allow `await supabase.from(t).upsert(...).select()` (no `.single()`).
      return Promise.resolve(nextResponse(table)).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

function nextResponse(table: string): SupabaseResponse {
  const queue = supabaseQueue[table];
  if (!queue || queue.length === 0) {
    throw new Error(`No queued supabase response for table "${table}". Calls so far: ${JSON.stringify(supabaseCalls)}`);
  }
  return queue.shift()!;
}

function queueSupabase(table: string, response: SupabaseResponse) {
  if (!supabaseQueue[table]) supabaseQueue[table] = [];
  supabaseQueue[table].push(response);
}

jest.mock('@/app/_lib/supabase', () => ({
  supabase: { from: (table: string) => makeBuilder(table) },
}));

// --- Dexie mock ------------------------------------------------------------
const tableState: Record<string, any[]> = {
  products: [],
  customers: [],
  sales: [],
  saleItems: [],
  payments: [],
  inventoryMovements: [],
};

function findById<T extends { id?: number }>(rows: T[], id: number) {
  return rows.find((r) => r.id === id);
}

function makeTable(name: string) {
  const api = {
    async get(id: number) {
      return findById(tableState[name], id);
    },
    async add(record: any) {
      const id = (tableState[name].length + 1);
      tableState[name].push({ ...record, id });
      return id;
    },
    async update(id: number, patch: any) {
      const row = findById(tableState[name], id);
      if (row) Object.assign(row, patch);
    },
    async clear() {
      tableState[name] = [];
    },
    async toArray() {
      return [...tableState[name]];
    },
    where(_field: string) {
      return {
        equals(value: any) {
          const filtered = tableState[name].filter((r: any) => r.sku === value || r.saleId === value || r.syncStatus === value);
          return {
            toArray: async () => filtered,
            first: async () => filtered[0],
            count: async () => filtered.length,
          };
        },
        anyOf(...values: any[]) {
          const filtered = tableState[name].filter((r: any) => values.includes(r.syncStatus));
          return { toArray: async () => filtered, count: async () => filtered.length };
        },
      };
    },
  };
  return api;
}

jest.mock('@/app/_db/db', () => {
  const actual = jest.requireActual('@/app/_db/db');
  return {
    __esModule: true,
    ...actual,
    db: new Proxy({} as any, {
      get(_target, prop: string) {
        if (prop === 'transaction') {
          return async (_mode: string, _tables: any[], cb: () => Promise<any>) => cb();
        }
        if (!tableState[prop]) return undefined;
        return makeTable(prop);
      },
    }),
    default: new Proxy({} as any, {
      get(_target, prop: string) {
        if (prop === 'transaction') {
          return async (_mode: string, _tables: any[], cb: () => Promise<any>) => cb();
        }
        if (!tableState[prop]) return undefined;
        return makeTable(prop);
      },
    }),
  };
});

// --- Logger mock (silence) ------------------------------------------------
jest.mock('@/app/_lib/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
}));

// Now load sync after mocks are wired up.
import * as sync from '@/app/_lib/sync';

function resetState() {
  Object.keys(tableState).forEach((k) => (tableState[k] = []));
  Object.keys(supabaseQueue).forEach((k) => delete supabaseQueue[k]);
  supabaseCalls.length = 0;
}

beforeEach(() => {
  resetState();
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

// --------------------------------------------------------------------------

describe('isOnline', () => {
  it('returns navigator.onLine', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    expect(sync.isOnline()).toBe(false);
  });
});

describe('syncPendingData', () => {
  it('returns offline error without touching supabase', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const result = await sync.syncPendingData();
    expect(result.success).toBe(false);
    expect(result.errors).toEqual(['Device is offline']);
    expect(supabaseCalls).toHaveLength(0);
  });

  it('syncs a sale end-to-end with idempotency keys', async () => {
    // Seed: one synced product, one pending sale with one item and one payment.
    tableState.products.push({
      id: 1,
      sku: 'PROD-001',
      name: 'Aceite',
      priceUsd: 10,
      stockQuantity: 5,
      localId: 'product-supabase-uuid',
      syncStatus: SyncStatus.SYNCED,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    tableState.sales.push({
      id: 1,
      subtotalUsd: 10,
      ivaAmountUsd: 1.6,
      igtfAmountUsd: 0,
      totalAmountUsd: 11.6,
      exchangeRateVes: 40,
      totalAmountVes: 464,
      date: new Date('2026-04-20T12:00:00Z'),
      syncStatus: SyncStatus.PENDING,
      syncUuid: 'sale-uuid',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    tableState.saleItems.push({
      id: 1,
      saleId: 1,
      productId: 'PROD-001',
      quantity: 1,
      pricePerUnitUsd: 10,
      syncStatus: SyncStatus.PENDING,
      syncUuid: 'item-uuid',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    tableState.payments.push({
      id: 1,
      saleId: 1,
      method: 'usd_cash',
      amount: 11.6,
      syncStatus: SyncStatus.PENDING,
      syncUuid: 'payment-uuid',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    queueSupabase('sales', { data: { id: 'sale-supabase-id' }, error: null });
    queueSupabase('sale_items', { data: [{ id: 'item-supabase-id', local_uuid: 'item-uuid' }], error: null });
    queueSupabase('payments', { data: [{ id: 'payment-supabase-id', local_uuid: 'payment-uuid' }], error: null });

    const result = await sync.syncPendingData();

    expect(result.success).toBe(true);
    expect(result.failed).toBe(0);

    // Sale was sent with local_uuid + sale_date + UPSERT options.
    const saleCall = supabaseCalls.find((c) => c.table === 'sales' && c.method === 'upsert')!;
    expect(saleCall.payload.local_uuid).toBe('sale-uuid');
    expect(saleCall.payload.sale_date).toBe('2026-04-20T12:00:00.000Z');
    expect(saleCall.options).toEqual({ onConflict: 'local_uuid' });

    // Items + payments also use upsert.
    expect(supabaseCalls.find((c) => c.table === 'sale_items' && c.method === 'upsert')).toBeTruthy();
    expect(supabaseCalls.find((c) => c.table === 'payments' && c.method === 'upsert')).toBeTruthy();

    // Local rows now point to Supabase ids and are SYNCED.
    expect(tableState.sales[0].localId).toBe('sale-supabase-id');
    expect(tableState.sales[0].syncStatus).toBe(SyncStatus.SYNCED);
    expect(tableState.saleItems[0].localId).toBe('item-supabase-id');
    expect(tableState.saleItems[0].syncStatus).toBe(SyncStatus.SYNCED);
    expect(tableState.payments[0].localId).toBe('payment-supabase-id');
    expect(tableState.payments[0].syncStatus).toBe(SyncStatus.SYNCED);
  });

  it('marks sale ERROR when an item product cannot be resolved (no silent skip)', async () => {
    tableState.sales.push({
      id: 1,
      subtotalUsd: 10,
      ivaAmountUsd: 0,
      igtfAmountUsd: 0,
      totalAmountUsd: 10,
      exchangeRateVes: 40,
      totalAmountVes: 400,
      date: new Date('2026-04-20T12:00:00Z'),
      syncStatus: SyncStatus.PENDING,
      syncUuid: 'sale-uuid',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    tableState.saleItems.push({
      id: 1,
      saleId: 1,
      productId: 'GHOST-SKU',
      quantity: 1,
      pricePerUnitUsd: 10,
      syncStatus: SyncStatus.PENDING,
      syncUuid: 'item-uuid',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await sync.syncPendingData();

    expect(result.failed).toBe(1);
    expect(result.errors[0]).toMatch(/Product not found locally: GHOST-SKU/);

    // Sale was NOT inserted into supabase.
    expect(supabaseCalls.find((c) => c.table === 'sales')).toBeUndefined();

    // Local sale was marked as ERROR (loud failure, not silent SYNCED).
    expect(tableState.sales[0].syncStatus).toBe(SyncStatus.ERROR);
    expect(tableState.sales[0].syncError).toMatch(/GHOST-SKU/);
  });

  it('throws (does not silently swallow) when items upsert fails after sale upsert', async () => {
    tableState.products.push({
      id: 1,
      sku: 'PROD-001',
      localId: 'product-id',
      stockQuantity: 5,
      priceUsd: 10,
      name: 'Aceite',
      syncStatus: SyncStatus.SYNCED,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    tableState.sales.push({
      id: 1,
      subtotalUsd: 10,
      ivaAmountUsd: 0,
      igtfAmountUsd: 0,
      totalAmountUsd: 10,
      exchangeRateVes: 40,
      totalAmountVes: 400,
      date: new Date('2026-04-20T12:00:00Z'),
      syncStatus: SyncStatus.PENDING,
      syncUuid: 'sale-uuid',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    tableState.saleItems.push({
      id: 1,
      saleId: 1,
      productId: 'PROD-001',
      quantity: 1,
      pricePerUnitUsd: 10,
      syncStatus: SyncStatus.PENDING,
      syncUuid: 'item-uuid',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    queueSupabase('sales', { data: { id: 'sale-id' }, error: null });
    queueSupabase('sale_items', { data: null, error: { message: 'constraint violation' } });

    const result = await sync.syncPendingData();

    expect(result.failed).toBe(1);
    expect(result.errors[0]).toMatch(/sale_items upsert failed/);

    // Sale still has localId so a retry can find the orphan in the cloud and
    // reuse it via the local_uuid idempotency key (no duplicate).
    expect(tableState.sales[0].localId).toBe('sale-id');
    expect(tableState.sales[0].syncStatus).toBe(SyncStatus.ERROR);
  });

  it('payment failure also throws (no silent warn)', async () => {
    tableState.products.push({
      id: 1,
      sku: 'PROD-001',
      localId: 'product-id',
      stockQuantity: 5,
      priceUsd: 10,
      name: 'Aceite',
      syncStatus: SyncStatus.SYNCED,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    tableState.sales.push({
      id: 1,
      subtotalUsd: 10,
      ivaAmountUsd: 0,
      igtfAmountUsd: 0,
      totalAmountUsd: 10,
      exchangeRateVes: 40,
      totalAmountVes: 400,
      date: new Date('2026-04-20T12:00:00Z'),
      syncStatus: SyncStatus.PENDING,
      syncUuid: 'sale-uuid',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    tableState.saleItems.push({
      id: 1,
      saleId: 1,
      productId: 'PROD-001',
      quantity: 1,
      pricePerUnitUsd: 10,
      syncStatus: SyncStatus.PENDING,
      syncUuid: 'item-uuid',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    tableState.payments.push({
      id: 1,
      saleId: 1,
      method: 'usd_cash',
      amount: 10,
      syncStatus: SyncStatus.PENDING,
      syncUuid: 'payment-uuid',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    queueSupabase('sales', { data: { id: 'sale-id' }, error: null });
    queueSupabase('sale_items', { data: [{ id: 'item-id', local_uuid: 'item-uuid' }], error: null });
    queueSupabase('payments', { data: null, error: { message: 'rls violation' } });

    const result = await sync.syncPendingData();

    expect(result.failed).toBe(1);
    expect(result.errors[0]).toMatch(/payments upsert failed/);
    expect(tableState.sales[0].syncStatus).toBe(SyncStatus.ERROR);
  });

  it('also picks up SYNCING sales (interrupted mid-sync) for retry', async () => {
    tableState.products.push({
      id: 1,
      sku: 'PROD-001',
      localId: 'product-id',
      stockQuantity: 5,
      priceUsd: 10,
      name: 'Aceite',
      syncStatus: SyncStatus.SYNCED,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    tableState.sales.push({
      id: 1,
      subtotalUsd: 10,
      ivaAmountUsd: 0,
      igtfAmountUsd: 0,
      totalAmountUsd: 10,
      exchangeRateVes: 40,
      totalAmountVes: 400,
      date: new Date('2026-04-20T12:00:00Z'),
      syncStatus: SyncStatus.SYNCING, // crashed mid-sync previously
      syncUuid: 'sale-uuid',
      localId: 'sale-id-from-previous-attempt',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    queueSupabase('sales', { data: { id: 'sale-id-from-previous-attempt' }, error: null });

    const result = await sync.syncPendingData();
    expect(result.success).toBe(true);
    expect(tableState.sales[0].syncStatus).toBe(SyncStatus.SYNCED);

    // Sent with the same local_uuid → UPSERT collapses onto the same row.
    const saleCall = supabaseCalls.find((c) => c.table === 'sales' && c.method === 'upsert')!;
    expect(saleCall.payload.local_uuid).toBe('sale-uuid');
  });
});

describe('syncCustomer (via syncPendingData)', () => {
  it('upserts customer with local_uuid and stores returned Supabase id', async () => {
    tableState.customers.push({
      id: 1,
      name: 'Juan',
      email: 'juan@test.com',
      syncStatus: SyncStatus.PENDING,
      syncUuid: 'customer-uuid',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    queueSupabase('customers', { data: { id: 'customer-supabase-id' }, error: null });

    const result = await sync.syncPendingData();
    expect(result.success).toBe(true);

    const call = supabaseCalls.find((c) => c.table === 'customers' && c.method === 'upsert')!;
    expect(call.payload.local_uuid).toBe('customer-uuid');
    expect(call.options).toEqual({ onConflict: 'local_uuid' });

    expect(tableState.customers[0].localId).toBe('customer-supabase-id');
    expect(tableState.customers[0].syncStatus).toBe(SyncStatus.SYNCED);
  });
});

describe('fetchCustomersFromCloud', () => {
  it('inserts new customers and stores remote id + syncUuid', async () => {
    queueSupabase('customers', {
      data: [
        { id: 'remote-uuid-1', local_uuid: 'sync-uuid-1', name: 'Juan', email: 'j@test', phone: null, address: null, created_at: '2026-01-01', updated_at: '2026-01-01' },
        { id: 'remote-uuid-2', local_uuid: 'sync-uuid-2', name: 'Ana', email: null, phone: '555', address: null, created_at: '2026-01-02', updated_at: '2026-01-02' },
      ],
      error: null,
    });

    const inserted = await sync.fetchCustomersFromCloud();
    expect(inserted).toBe(2);
    expect(tableState.customers).toHaveLength(2);
    expect(tableState.customers[0]).toMatchObject({ name: 'Juan', localId: 'remote-uuid-1', syncUuid: 'sync-uuid-1', syncStatus: SyncStatus.SYNCED });
    expect(tableState.customers[1]).toMatchObject({ name: 'Ana', localId: 'remote-uuid-2', syncUuid: 'sync-uuid-2' });
  });

  it('skips remote rows whose local_uuid already exists locally (idempotent)', async () => {
    tableState.customers.push({
      id: 1, name: 'Juan', syncUuid: 'sync-uuid-1',
      syncStatus: SyncStatus.SYNCED, createdAt: new Date(), updatedAt: new Date(),
    });

    queueSupabase('customers', {
      data: [
        { id: 'remote-uuid-1', local_uuid: 'sync-uuid-1', name: 'Juan', email: null, phone: null, address: null, created_at: null, updated_at: null },
        { id: 'remote-uuid-2', local_uuid: 'sync-uuid-2', name: 'Ana', email: null, phone: null, address: null, created_at: null, updated_at: null },
      ],
      error: null,
    });

    const inserted = await sync.fetchCustomersFromCloud();
    expect(inserted).toBe(1);
    expect(tableState.customers).toHaveLength(2);
    expect(tableState.customers.find((c) => c.name === 'Ana')).toBeTruthy();
  });
});

describe('fetchSalesFromCloud', () => {
  it('downloads sale + items + payments and resolves remote UUIDs to local refs', async () => {
    tableState.products.push({
      id: 1, sku: 'PROD-001', name: 'Aceite', priceUsd: 10, stockQuantity: 5,
      localId: 'product-remote-1', syncStatus: SyncStatus.SYNCED,
      createdAt: new Date(), updatedAt: new Date(),
    });
    tableState.customers.push({
      id: 1, name: 'Juan', localId: 'customer-remote-1',
      syncStatus: SyncStatus.SYNCED, createdAt: new Date(), updatedAt: new Date(),
    });

    queueSupabase('sales', {
      data: [{
        id: 'sale-remote-1', local_uuid: 'sale-sync-1',
        customer_id: 'customer-remote-1',
        subtotal_usd: 10, iva_amount_usd: 1.6, igtf_amount_usd: 0,
        total_amount_usd: 11.6, exchange_rate_ves: 40, total_amount_ves: 464,
        sale_date: '2026-04-20T12:00:00Z', created_at: '2026-04-20T12:00:00Z',
      }],
      error: null,
    });
    queueSupabase('sale_items', {
      data: [{ id: 'item-remote-1', local_uuid: 'item-sync-1', sale_id: 'sale-remote-1', product_id: 'product-remote-1', quantity: 1, price_per_unit_usd: 10 }],
      error: null,
    });
    queueSupabase('payments', {
      data: [{ id: 'payment-remote-1', local_uuid: 'payment-sync-1', sale_id: 'sale-remote-1', method: 'usd_cash', amount: 11.6, reference_code: null }],
      error: null,
    });

    const inserted = await sync.fetchSalesFromCloud();
    expect(inserted).toBe(1);

    expect(tableState.sales[0]).toMatchObject({
      customerId: 1,                     // resolved from customer.localId === 'customer-remote-1'
      localId: 'sale-remote-1',
      syncUuid: 'sale-sync-1',
      totalAmountUsd: 11.6,
      syncStatus: SyncStatus.SYNCED,
    });
    expect(tableState.saleItems[0]).toMatchObject({
      saleId: tableState.sales[0].id,    // local numeric id, not remote UUID
      productId: 'PROD-001',             // resolved from product.localId === 'product-remote-1'
      localId: 'item-remote-1',
    });
    expect(tableState.payments[0]).toMatchObject({
      saleId: tableState.sales[0].id,
      method: 'usd_cash',
      amount: 11.6,
      localId: 'payment-remote-1',
    });
  });

  it('skips sales whose syncUuid already exists locally (idempotent)', async () => {
    tableState.sales.push({
      id: 1, syncUuid: 'sale-sync-1', subtotalUsd: 10,
      ivaAmountUsd: 0, igtfAmountUsd: 0, totalAmountUsd: 10,
      exchangeRateVes: 40, totalAmountVes: 400, date: new Date(),
      syncStatus: SyncStatus.SYNCED, createdAt: new Date(), updatedAt: new Date(),
    });

    queueSupabase('sales', {
      data: [{
        id: 'sale-remote-1', local_uuid: 'sale-sync-1', customer_id: null,
        subtotal_usd: 10, iva_amount_usd: 0, igtf_amount_usd: 0,
        total_amount_usd: 10, exchange_rate_ves: 40, total_amount_ves: 400,
        sale_date: null, created_at: null,
      }],
      error: null,
    });

    const inserted = await sync.fetchSalesFromCloud();
    expect(inserted).toBe(0);
    expect(tableState.sales).toHaveLength(1);
  });

  it('skips items whose product is not present locally', async () => {
    queueSupabase('sales', {
      data: [{
        id: 'sale-remote-1', local_uuid: 'sale-sync-1', customer_id: null,
        subtotal_usd: 10, iva_amount_usd: 0, igtf_amount_usd: 0,
        total_amount_usd: 10, exchange_rate_ves: 40, total_amount_ves: 400,
        sale_date: null, created_at: null,
      }],
      error: null,
    });
    queueSupabase('sale_items', {
      data: [{ id: 'item-1', local_uuid: 'isync-1', sale_id: 'sale-remote-1', product_id: 'unknown-product', quantity: 1, price_per_unit_usd: 10 }],
      error: null,
    });
    queueSupabase('payments', { data: [], error: null });

    const inserted = await sync.fetchSalesFromCloud();
    expect(inserted).toBe(1);
    expect(tableState.sales).toHaveLength(1);
    expect(tableState.saleItems).toHaveLength(0); // orphan item dropped
  });
});

describe('fetchInventoryMovementsFromCloud', () => {
  it('clears local movements and reinserts remote rows, mapping product_id to local id', async () => {
    tableState.products.push({
      id: 1, sku: 'PROD-001', name: 'Aceite', priceUsd: 10, stockQuantity: 5,
      localId: 'product-remote-1', syncStatus: SyncStatus.SYNCED,
      createdAt: new Date(), updatedAt: new Date(),
    });
    tableState.inventoryMovements.push({ id: 1, productId: 999, type: 'sale', quantity: -1 } as any);

    queueSupabase('inventory_movements', {
      data: [{
        id: 'mov-1', product_id: 'product-remote-1',
        product_sku: 'PROD-001', product_name: 'Aceite',
        type: 'initial', quantity: 5, previous_stock: 0, new_stock: 5,
        notes: 'seed', created_by: 'system', created_at: '2026-01-01',
      }],
      error: null,
    });

    const inserted = await sync.fetchInventoryMovementsFromCloud();
    expect(inserted).toBe(1);
    expect(tableState.inventoryMovements).toHaveLength(1);
    expect(tableState.inventoryMovements[0]).toMatchObject({
      productId: 1,                // resolved from product.localId === 'product-remote-1'
      productSku: 'PROD-001',
      type: 'initial',
      quantity: 5,
    });
  });

  it('skips movements whose product is not present locally', async () => {
    queueSupabase('inventory_movements', {
      data: [{
        id: 'mov-1', product_id: 'unknown-product',
        product_sku: 'X', product_name: 'X',
        type: 'sale', quantity: -1, previous_stock: 5, new_stock: 4,
        notes: null, created_by: null, created_at: null,
      }],
      error: null,
    });

    const inserted = await sync.fetchInventoryMovementsFromCloud();
    expect(inserted).toBe(0);
    expect(tableState.inventoryMovements).toHaveLength(0);
  });
});
