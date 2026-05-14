'use client';

import { useState, useEffect } from 'react';
import { db, SyncStatus } from '@/app/_db/db';
import {
  bidirectionalSync,
  getSyncStats,
  detectDuplicateSales,
  getDetailedSyncStatus,
} from '@/app/_lib/sync';
import {
  Wrench,
  Database,
  Cloud,
  AlertTriangle,
  RefreshCcw,
  Search,
  Trash2,
  Eraser,
  Info,
} from 'lucide-react';
import { TOKENS, PMBtnPrimary, PMBtnSecondary } from '@/app/_components/_pmTheme';

export default function DiagnosticoPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [dbStats, setDbStats] = useState({
    products: 0,
    sales: 0,
    movements: 0,
    pending: 0,
  });
  const [duplicates, setDuplicates] = useState<
    Array<{ id: string; total: number; created_at: string }>
  >([]);
  const [cloudStats, setCloudStats] = useState({ products: 0, sales: 0, movements: 0 });

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const products = await db.products.count();
    const sales = await db.sales.count();
    const movements = await db.inventoryMovements.count();
    const stats = await getSyncStats();
    setDbStats({ products, sales, movements, pending: stats.totalPending });
  }

  async function checkDuplicates() {
    setIsRunning(true);
    try {
      addLog('🔍 Buscando ventas duplicadas en Supabase...');
      const result = await detectDuplicateSales();
      setDuplicates(result.duplicates);
      addLog(`📊 Total ventas en nube: ${result.totalSales}`);
      addLog(`🔁 Ventas duplicadas encontradas: ${result.duplicates.length}`);

      if (result.duplicates.length > 0) {
        addLog('⚠️ Se encontraron ventas duplicadas:');
        result.duplicates.forEach((d) => {
          addLog(
            `   - ID: ${d.id.substring(0, 8)}... | Total: $${d.total} | ${new Date(d.created_at).toLocaleString()}`,
          );
        });
      } else {
        addLog('✅ No se encontraron ventas duplicadas');
      }
    } catch (error: any) {
      addLog(`❌ Error al buscar duplicados: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  }

  async function loadDetailedStats() {
    setIsRunning(true);
    try {
      addLog('📊 Obteniendo estadísticas detalladas...');
      const status = await getDetailedSyncStatus();

      addLog('=== ESTADO LOCAL ===');
      addLog(
        `Productos: ${status.local.products.total} (✅${status.local.products.synced} ⏳${status.local.products.pending} ❌${status.local.products.error})`,
      );
      addLog(
        `Ventas: ${status.local.sales.total} (✅${status.local.sales.synced} ⏳${status.local.sales.pending} ❌${status.local.sales.error})`,
      );

      addLog('=== ESTADO NUBE ===');
      addLog(`Productos: ${status.cloud.products}`);
      addLog(`Ventas: ${status.cloud.sales}`);

      setCloudStats({
        products: status.cloud.products,
        sales: status.cloud.sales,
        movements: 0,
      });
      setDuplicates(status.duplicates.sales);

      if (status.duplicates.sales.length > 0) {
        addLog(`⚠️ ${status.duplicates.sales.length} ventas duplicadas detectadas en nube`);
      }

      addLog('✅ Estadísticas detalladas cargadas');
    } catch (error: any) {
      addLog(`❌ Error: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  }

  function addLog(message: string) {
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  }

  async function testSync() {
    setIsRunning(true);
    setLogs([]);

    try {
      addLog('🚀 Iniciando prueba de sincronización...');
      const productCount = await db.products.count();
      addLog(`   ✅ Productos locales: ${productCount}`);

      const pendingProducts = await db.products
        .where('syncStatus')
        .equals(SyncStatus.PENDING)
        .toArray();
      const pendingSales = await db.sales
        .where('syncStatus')
        .equals(SyncStatus.PENDING)
        .toArray();

      addLog(`   📦 Productos pendientes: ${pendingProducts.length}`);
      addLog(`   🛒 Ventas pendientes: ${pendingSales.length}`);

      addLog('☁️ Iniciando sincronización con Supabase...');
      const result = await bidirectionalSync();

      if (result.success) {
        addLog(`✅ Sincronización exitosa!`);
        addLog(`   📤 Subidos: ${result.uploaded}`);
        addLog(`   📥 Descargados: ${result.downloaded}`);
      } else {
        addLog(`❌ Sincronización falló:`);
        result.errors.forEach((err) => addLog(`   - ${err}`));
      }

      await loadStats();
    } catch (error: any) {
      addLog(`❌ Error: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsRunning(false);
    }
  }

  async function clearLocalData() {
    if (!confirm('¿Estás seguro? Esto eliminará todos los datos locales.')) return;

    try {
      addLog('🗑️ Limpiando datos locales...');
      await db.products.clear();
      await db.sales.clear();
      await db.saleItems.clear();
      await db.customers.clear();
      await db.payments.clear();
      addLog('✅ Datos locales eliminados');
      await loadStats();
    } catch (err: any) {
      addLog(`❌ Error al limpiar: ${err.message}`);
    }
  }

  async function resetDatabase() {
    if (!confirm('⚠️ ATENCIÓN: Esto eliminará TODA la base de datos y la recreará. ¿Continuar?'))
      return;

    try {
      addLog('🔄 Reseteando base de datos...');
      await db.delete();
      addLog('✅ Base de datos eliminada');
      addLog('🔄 Recargando página...');
      window.location.reload();
    } catch (err: any) {
      addLog(`❌ Error al resetear: ${err.message}`);
    }
  }

  async function testSupabaseConnection() {
    try {
      addLog('🔌 Probando conexión a Supabase...');
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );

      const { data: products, error: pError } = await supabase.from('products').select('*');
      if (pError) throw pError;
      addLog(`✅ Productos en la nube: ${products?.length || 0}`);

      const { data: sales, error: sError } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (sError) throw sError;
      addLog(`✅ Ventas en la nube: ${sales?.length || 0} (últimas 10)`);

      if (sales && sales.length > 0) {
        addLog('   Últimas ventas sincronizadas:');
        sales.forEach((s: any) => {
          addLog(`     - #$${s.total_amount_usd} (${new Date(s.created_at).toLocaleDateString()})`);
        });
      }
    } catch (err: any) {
      addLog(`❌ Error de conexión: ${err.message}`);
    }
  }

  async function clearSupabaseSales() {
    if (!confirm('⚠️ ATENCIÓN: Esto eliminará TODAS las ventas de Supabase. ¿Estás seguro?'))
      return;

    try {
      addLog('🗑️ Eliminando ventas de Supabase...');
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );

      const { error: itemsError } = await supabase
        .from('sale_items')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (itemsError) throw itemsError;
      addLog('✅ Items de ventas eliminados');

      const { error: salesError } = await supabase
        .from('sales')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (salesError) throw salesError;
      addLog('✅ Ventas eliminadas de Supabase');

      const localSales = await db.sales.toArray();
      for (const sale of localSales) {
        await db.sales.update(sale.id!, {
          syncStatus: SyncStatus.PENDING,
          localId: undefined,
          updatedAt: new Date(),
        });
      }
      addLog(`✅ ${localSales.length} ventas locales marcadas como pendientes`);

      await loadStats();
    } catch (err: any) {
      addLog(`❌ Error: ${err.message}`);
    }
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-[1200px] mx-auto px-6 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="pm-eyebrow mb-1">Sistema / Sincronización</div>
            <div className="flex items-center gap-2.5">
              <div
                className="flex items-center justify-center h-9 w-9 rounded"
                style={{ background: TOKENS.charcoal, color: '#fff' }}
              >
                <Wrench className="h-4 w-4" />
              </div>
              <div>
                <h1
                  className="text-[24px] font-bold leading-8 tracking-[-0.02em]"
                  style={{ color: TOKENS.charcoal }}
                >
                  Diagnóstico de Sincronización
                </h1>
                <p className="text-[13px]" style={{ color: TOKENS.slate500 }}>
                  Inspecciona el estado local vs nube y resuelve duplicados
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {duplicates.length > 0 && (
          <div
            className="rounded p-4"
            style={{
              background: TOKENS.redSoft,
              border: `1px solid ${TOKENS.red}`,
              borderLeft: `3px solid ${TOKENS.red}`,
            }}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="h-5 w-5 shrink-0 mt-0.5"
                style={{ color: TOKENS.red }}
              />
              <div className="flex-1">
                <div
                  className="text-[11px] font-bold uppercase tracking-[0.05em]"
                  style={{ color: TOKENS.red }}
                >
                  Ventas duplicadas detectadas
                </div>
                <p className="text-[13px] mt-0.5" style={{ color: TOKENS.charcoal }}>
                  Se encontraron <strong>{duplicates.length}</strong> ventas duplicadas en
                  Supabase. Esto puede causar problemas en los reportes. Usa{' '}
                  <em>“Limpiar Ventas Nube”</em> para eliminarlas.
                </p>
                <details className="mt-2">
                  <summary
                    className="cursor-pointer text-[12px] font-bold"
                    style={{ color: TOKENS.red }}
                  >
                    Ver detalles ({duplicates.length})
                  </summary>
                  <ul className="mt-2 text-[12px] space-y-0.5">
                    {duplicates.map((d, i) => (
                      <li key={i} className="pm-tnum" style={{ color: TOKENS.charcoal }}>
                        ID:{' '}
                        <code
                          className="px-1 py-0.5 rounded"
                          style={{ background: '#fff' }}
                        >
                          {d.id.substring(0, 8)}…
                        </code>{' '}
                        · Total: ${d.total} ·{' '}
                        {new Date(d.created_at).toLocaleString()}
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            </div>
          </div>
        )}

        <div
          className="rounded p-4 flex items-start gap-3"
          style={{
            background: TOKENS.slate50,
            border: `1px solid ${TOKENS.slate200}`,
            borderLeft: `3px solid ${TOKENS.charcoal}`,
          }}
        >
          <Info className="h-4 w-4 shrink-0 mt-0.5" style={{ color: TOKENS.charcoal }} />
          <p className="text-[13px]" style={{ color: TOKENS.slate700 }}>
            Las ventas se sincronizan correctamente. Si ves más registros en Supabase de los
            esperados, pueden ser ventas de prueba anteriores. Usa{' '}
            <em>“Ver Estadísticas Detalladas”</em> para analizar el estado y{' '}
            <em>“Limpiar Ventas Nube”</em> para eliminarlas.
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiTile
            label="Productos Locales"
            value={dbStats.products}
            icon={<Database className="h-3.5 w-3.5" />}
          />
          <KpiTile
            label="Ventas Locales"
            value={dbStats.sales}
            icon={<Database className="h-3.5 w-3.5" />}
          />
          <KpiTile
            label="Pendientes Sync"
            value={dbStats.pending}
            icon={<RefreshCcw className="h-3.5 w-3.5" />}
            tone={dbStats.pending > 0 ? 'warn' : undefined}
          />
          <KpiTile
            label="Productos Nube"
            value={cloudStats.products}
            icon={<Cloud className="h-3.5 w-3.5" />}
          />
          <KpiTile
            label="Ventas Nube"
            value={cloudStats.sales}
            icon={<Cloud className="h-3.5 w-3.5" />}
          />
        </div>

        {/* Actions */}
        <section className="pm-card p-5">
          <h3 className="pm-section-title">
            <Wrench className="h-4 w-4" style={{ color: TOKENS.slate500 }} />
            Acciones
          </h3>

          <div className="space-y-3">
            <PMBtnPrimary onClick={testSync} disabled={isRunning} className="w-full h-11">
              <RefreshCcw className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
              {isRunning ? 'Ejecutando…' : 'Probar Sincronización'}
            </PMBtnPrimary>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <PMBtnSecondary onClick={testSupabaseConnection} disabled={isRunning}>
                <Cloud className="h-4 w-4" />
                Ver Datos en Nube
              </PMBtnSecondary>
              <DangerBtn onClick={clearSupabaseSales} disabled={isRunning}>
                <Eraser className="h-4 w-4" />
                Limpiar Ventas Nube
              </DangerBtn>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <PMBtnSecondary onClick={loadDetailedStats} disabled={isRunning}>
                <Database className="h-4 w-4" />
                Estadísticas Detalladas
              </PMBtnSecondary>
              <PMBtnSecondary onClick={checkDuplicates} disabled={isRunning}>
                <Search className="h-4 w-4" />
                Buscar Duplicados
              </PMBtnSecondary>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <DangerBtn onClick={clearLocalData} disabled={isRunning}>
                <Trash2 className="h-4 w-4" />
                Limpiar Tablas Locales
              </DangerBtn>
              <DangerBtn onClick={resetDatabase} disabled={isRunning} hard>
                <AlertTriangle className="h-4 w-4" />
                Reset Total DB
              </DangerBtn>
            </div>
          </div>
        </section>

        {/* Console */}
        <section className="pm-card overflow-hidden">
          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{
              borderBottom: `1px solid ${TOKENS.slate200}`,
              background: TOKENS.charcoal,
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: TOKENS.orange }}
              />
              <span
                className="text-[11px] font-bold uppercase tracking-[0.05em]"
                style={{ color: '#fff' }}
              >
                Log de eventos
              </span>
            </div>
            {logs.length > 0 && (
              <button
                onClick={() => setLogs([])}
                className="text-[11px] font-bold"
                style={{ color: TOKENS.slate300 }}
              >
                Limpiar
              </button>
            )}
          </div>
          <div
            className="p-4 font-mono text-[12px] h-80 overflow-y-auto"
            style={{ background: '#0a0e16', color: '#a3e635' }}
          >
            {logs.length === 0 ? (
              <p style={{ color: TOKENS.slate400 }}>Esperando acción…</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="mb-0.5 leading-relaxed">
                  {log}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function KpiTile({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: 'warn';
}) {
  return (
    <div className="pm-card px-3 py-2.5">
      <div className="flex items-center gap-1.5 pm-eyebrow">
        <span style={{ color: TOKENS.slate400 }}>{icon}</span>
        {label}
      </div>
      <div
        className="pm-tnum text-[22px] font-bold leading-7 tracking-[-0.02em] mt-0.5"
        style={{ color: tone === 'warn' ? TOKENS.amber : TOKENS.charcoal }}
      >
        {value}
      </div>
    </div>
  );
}

function DangerBtn({
  children,
  onClick,
  disabled,
  hard,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  hard?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 px-3 h-9 text-[13px] font-semibold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: hard ? TOKENS.red : '#fff',
        color: hard ? '#fff' : TOKENS.red,
        border: `1px solid ${hard ? TOKENS.red : TOKENS.red}`,
      }}
    >
      {children}
    </button>
  );
}
