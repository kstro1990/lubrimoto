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
