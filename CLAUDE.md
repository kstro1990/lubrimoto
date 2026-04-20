# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (PWA disabled in development)
npm run build     # Production build
npm run lint      # ESLint
npm run test      # Jest in watch mode (interactive)
npx jest --testPathPattern="<filename>"  # Run a single test file
```

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Architecture Overview

**LubriMotos ERP** is an offline-first PWA for a motorcycle lubricants/parts shop in Venezuela. All data is stored locally first (IndexedDB) and synced to Supabase when online.

### Data Layer

- **Local DB** (`app/_db/db.ts`): Dexie (IndexedDB wrapper), currently at schema version 8. All entities implement `Syncable` which adds `syncUuid` (client-generated idempotency key), `localId` (Supabase UUID returned after sync), `syncStatus` (`pending | syncing | synced | error`), and timestamps. Schema migrations are additive — always add a new `this.version(N)` block.

- **Supabase** (`app/_lib/supabase.ts`): Cloud backend. Migrations live in `supabase/migrations/`. The Supabase schema uses UUID PKs; client-generated `syncUuid` values are stored in a `local_uuid UNIQUE` column on `sales`, `sale_items`, `payments`, and `customers` (see `0004_sync_idempotency.sql`).

- **Sync engine** (`app/_lib/sync.ts`): Syncs pending records to Supabase using `UPSERT onConflict: 'local_uuid'` so any retry collapses onto the same remote row instead of duplicating. `syncSale` pre-validates that every referenced product and customer can be synced before touching the sale, and throws loudly on item/payment failures rather than silently dropping data. `syncPendingData` picks up both `PENDING` and `SYNCING` sales so a crash mid-sync is finished on the next attempt. `fetchProductsFromCloud` clears and re-inserts all local products from Supabase. Called automatically on app load and when the device comes back online.

### Module Structure

Pages live in `app/(modules)/` and are self-contained:

| Route | Module |
|---|---|
| `/ventas` | POS-style sales entry with product search, multi-payment methods |
| `/inventario` | Product catalog, stock levels, movement history |
| `/tasas` | BCV vs parallel exchange rate tracking and history |
| `/calculadora` | Price calculator accounting for dual-rate exposure |
| `/punto-equilibrio` | Break-even analysis, fixed expenses, monthly/daily sales targets |
| `/reportes` | Business performance reports using Recharts |
| `/diagnostico` | Sync diagnostics: local vs cloud record counts, duplicate detection |

### Shared Infrastructure

- **`app/_lib/`** — Core services: `supabase.ts` (client), `sync.ts` (sync engine), `logger.ts`, `printing.ts`
- **`app/_services/dolarapi.ts`** — Fetches BCV and parallel exchange rates from `ve.dolarapi.com`; caches to `localStorage` for offline fallback; rate-limited to one request per 5 seconds
- **`app/_contexts/`** — `TasasContext` (current BCV/parallel rates, shared app-wide), `ThemeContext` (dark/light mode)
- **`app/_hooks/`** — `useFinanzasVZLA` (price calculation logic with exchange rate protection factor), `usePuntoEquilibrio` (break-even computation), `useSincronizacionTasas` (rate sync lifecycle)
- **`app/_types/finanzas.ts`** — TypeScript types for Venezuelan finance calculations

### Key Design Patterns

**Offline-first writes**: Every write goes to IndexedDB with `syncStatus: 'pending'`. The sync engine picks up pending records and pushes them to Supabase, storing the returned Supabase UUID back in `localId`.

**Dual-currency**: All monetary amounts are stored in USD. Sales also record `exchangeRateVes` and `totalAmountVes` at the time of sale. The `CalculoPrecioVenezuela` model calculates a `factorProteccion` (`tasaParalelo / tasaBCV`) to hedge against exchange rate risk when pricing in bolívares.

**Module alias**: `@/app/` maps to `<rootDir>/app/` (configured in both `tsconfig.json` and `jest.config.mjs`).

**PWA**: Configured via `@ducanh2912/next-pwa` in `next.config.mjs`. Service Worker is disabled in development. The offline fallback page is `app/_offline/page.tsx`.

### Testing

Tests are in `__tests__/` mirroring the `app/` directory structure. Uses Jest with `jest-environment-jsdom` and `ts-jest`. Dexie (IndexedDB) requires mocking in tests since jsdom doesn't support it natively.
