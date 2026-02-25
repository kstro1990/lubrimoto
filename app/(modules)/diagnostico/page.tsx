'use client';

import { useState, useEffect } from 'react';
import { db, SyncStatus } from '@/app/_db/db';
import { bidirectionalSync, getSyncStats, detectDuplicateSales, getDetailedSyncStatus } from '@/app/_lib/sync';

interface TableStats {
  local: number;
  synced: number;
  pending: number;
  error: number;
}

interface FullDbStats {
  products: TableStats;
  sales: TableStats;
  saleItems: TableStats;
  payments: TableStats;
  customers: TableStats;
  exchangeRates: TableStats;
  inventoryMovements: TableStats;
  gastosFijos: TableStats;
  configuracionMetas: TableStats;
  historialVentasMeta: TableStats;
  configuracionCambiaria: TableStats;
  historialTasas: TableStats;
  calculosPrecios: TableStats;
}

interface CloudCounts {
  products: number;
  sales: number;
  fixedExpenses: number;
  goalsConfiguration: number;
  salesGoalsHistory: number;
  customers: number;
  exchangeRates: number;
}

export default function DiagnosticoPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [dbStats, setDbStats] = useState({ products: 0, sales: 0, pending: 0 });
  const [duplicates, setDuplicates] = useState<Array<{ id: string; total: number; created_at: string }>>([]);
  const [cloudStats, setCloudStats] = useState({ products: 0, sales: 0 });
  const [fullDbStats, setFullDbStats] = useState<FullDbStats | null>(null);
  const [cloudCounts, setCloudCounts] = useState<CloudCounts | null>(null);
  const [showFullDb, setShowFullDb] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const products = await db.products.count();
    const sales = await db.sales.count();
    const stats = await getSyncStats();
    setDbStats({ products, sales, pending: stats.totalPending });
  }

  async function loadFullDatabaseStats() {
    setIsRunning(true);
    try {
      addLog('📊 Cargando estadísticas completas de la base de datos...');
      
      const getTableStats = async (table: any): Promise<TableStats> => {
        const all = await table.toArray();
        return {
          local: all.length,
          synced: all.filter((r: any) => r.syncStatus === SyncStatus.SYNCED).length,
          pending: all.filter((r: any) => r.syncStatus === SyncStatus.PENDING).length,
          error: all.filter((r: any) => r.syncStatus === SyncStatus.ERROR).length,
        };
      };

      const stats: FullDbStats = {
        products: await getTableStats(db.products),
        sales: await getTableStats(db.sales),
        saleItems: await getTableStats(db.saleItems),
        payments: await getTableStats(db.payments),
        customers: await getTableStats(db.customers),
        exchangeRates: await getTableStats(db.exchangeRates),
        inventoryMovements: await getTableStats(db.inventoryMovements),
        gastosFijos: await getTableStats(db.gastosFijos),
        configuracionMetas: await getTableStats(db.configuracionMetas),
        historialVentasMeta: await getTableStats(db.historialVentasMeta),
        configuracionCambiaria: await getTableStats(db.configuracionCambiaria),
        historialTasas: await getTableStats(db.historialTasas),
        calculosPrecios: await getTableStats(db.calculosPrecios),
      };

      setFullDbStats(stats);
      addLog('✅ Estadísticas locales cargadas');

      // Cargar datos de la nube
      addLog('☁️ Cargando datos de Supabase...');
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const [productsRes, salesRes, expensesRes, goalsRes, historyRes, customersRes, ratesRes] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('sales').select('*', { count: 'exact', head: true }),
        supabase.from('fixed_expenses').select('*', { count: 'exact', head: true }),
        supabase.from('goals_configuration').select('*', { count: 'exact', head: true }),
        supabase.from('sales_goals_history').select('*', { count: 'exact', head: true }),
        supabase.from('customers').select('*', { count: 'exact', head: true }),
        supabase.from('exchange_rates').select('*', { count: 'exact', head: true }),
      ]);

      const cloud: CloudCounts = {
        products: productsRes.count || 0,
        sales: salesRes.count || 0,
        fixedExpenses: expensesRes.count || 0,
        goalsConfiguration: goalsRes.count || 0,
        salesGoalsHistory: historyRes.count || 0,
        customers: customersRes.count || 0,
        exchangeRates: ratesRes.count || 0,
      };

      setCloudCounts(cloud);
      setShowFullDb(true);
      addLog('✅ Datos de Supabase cargados');

      // Mostrar resumen
      addLog('=== RESUMEN BASE DE DATOS ===');
      addLog(`📦 Products:   Local=${stats.products.local} | Cloud=${cloud.products} | ✅${stats.products.synced} ⏳${stats.products.pending}`);
      addLog(`💰 Sales:      Local=${stats.sales.local} | Cloud=${cloud.sales} | ✅${stats.sales.synced} ⏳${stats.sales.pending}`);
      addLog(`📝 SaleItems:  Local=${stats.saleItems.local}`);
      addLog(`💳 Payments:   Local=${stats.payments.local}`);
      addLog(`👥 Customers:  Local=${stats.customers.local} | Cloud=${cloud.customers}`);
      addLog(`💵 Exchange:   Local=${stats.exchangeRates.local} | Cloud=${cloud.exchangeRates}`);
      addLog(`📈 Movements:  Local=${stats.inventoryMovements.local}`);
      addLog(`🏠 FixedExp:   Local=${stats.gastosFijos.local} | Cloud=${cloud.fixedExpenses} | ✅${stats.gastosFijos.synced}`);
      addLog(`🎯 GoalsConf:  Local=${stats.configuracionMetas.local} | Cloud=${cloud.goalsConfiguration} | ✅${stats.configuracionMetas.synced}`);
      addLog(`📊 GoalsHist:  Local=${stats.historialVentasMeta.local} | Cloud=${cloud.salesGoalsHistory} | ✅${stats.historialVentasMeta.synced}`);
      addLog(`💱 Cambiaria:  Local=${stats.configuracionCambiaria.local}`);
      addLog(`📜 Tasas:      Local=${stats.historialTasas.local}`);
      addLog(`🧮 Precios:    Local=${stats.calculosPrecios.local}`);

    } catch (err: any) {
      addLog(`❌ Error: ${err.message}`);
      console.error('Full DB stats error:', err);
    } finally {
      setIsRunning(false);
    }
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
        result.duplicates.forEach(d => {
          addLog(`   - ID: ${d.id.substring(0, 8)}... | Total: $${d.total} | ${new Date(d.created_at).toLocaleString()}`);
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
      addLog(`Productos: ${status.local.products.total} (✅${status.local.products.synced} ⏳${status.local.products.pending} ❌${status.local.products.error})`);
      addLog(`Ventas: ${status.local.sales.total} (✅${status.local.sales.synced} ⏳${status.local.sales.pending} ❌${status.local.sales.error})`);
      
      addLog('=== ESTADO NUBE ===');
      addLog(`Productos: ${status.cloud.products}`);
      addLog(`Ventas: ${status.cloud.sales}`);
      
      setCloudStats({ products: status.cloud.products, sales: status.cloud.sales });
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
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  }

  async function testSync() {
    setIsRunning(true);
    setLogs([]);
    
    try {
      addLog('🚀 Iniciando prueba de sincronización...');
      
      // Verificar IndexedDB
      addLog('📊 Verificando IndexedDB...');
      const productCount = await db.products.count();
      addLog(`   ✅ Productos locales: ${productCount}`);
      
      // Verificar productos pendientes con detalles
      const pendingProducts = await db.products.where('syncStatus').equals(SyncStatus.PENDING).toArray();
      const pendingSales = await db.sales.where('syncStatus').equals(SyncStatus.PENDING).toArray();
      
      addLog(`   📦 Productos pendientes: ${pendingProducts.length}`);
      addLog(`   🛒 Ventas pendientes: ${pendingSales.length}`);
      
      if (pendingProducts.length > 0) {
        addLog('   Detalles de productos pendientes:');
        pendingProducts.forEach(p => {
          addLog(`     - ${p.sku}: ${p.name} (ID: ${p.id})`);
          console.log('Pending product:', p);
        });
      }
      
      if (pendingSales.length > 0) {
        addLog('   Detalles de ventas pendientes:');
        pendingSales.forEach(s => {
          addLog(`     - Venta #${s.id}: $${s.totalAmountUsd} (ID: ${s.id})`);
          console.log('Pending sale:', s);
        });
      }
      
      // Intentar sincronización
      addLog('☁️ Iniciando sincronización con Supabase...');
      console.log('Starting bidirectionalSync...');
      const result = await bidirectionalSync();
      console.log('Sync result:', result);
      
      if (result.success) {
        addLog(`✅ Sincronización exitosa!`);
        addLog(`   📤 Subidos: ${result.uploaded}`);
        addLog(`   📥 Descargados: ${result.downloaded}`);
      } else {
        addLog(`❌ Sincronización falló:`);
        result.errors.forEach(err => {
          addLog(`   - ${err}`);
          console.error('Sync error:', err);
        });
      }
      
      // Actualizar estadísticas
      await loadStats();
      
    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown error';
      const errorStack = error?.stack || 'No stack trace';
      addLog(`❌ Error: ${errorMsg}`);
      console.error('Full error:', error);
      console.error('Stack trace:', errorStack);
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
      console.error('Clear error:', err);
    }
  }

  async function resetDatabase() {
    if (!confirm('⚠️ ATENCIÓN: Esto eliminará TODA la base de datos y la recreará. ¿Continuar?')) return;
    
    try {
      addLog('🔄 Reseteando base de datos...');
      await db.delete();
      addLog('✅ Base de datos eliminada');
      
      // Recargar página para reinicializar
      addLog('🔄 Recargando página...');
      window.location.reload();
    } catch (err: any) {
      addLog(`❌ Error al resetear: ${err.message}`);
      console.error('Reset error:', err);
    }
  }

  async function testSupabaseConnection() {
    try {
      addLog('🔌 Probando conexión a Supabase...');
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      // Verificar productos
      const { data: products, error: pError } = await supabase.from('products').select('*');
      if (pError) throw pError;
      addLog(`✅ Productos en la nube: ${products?.length || 0}`);
      
      // Verificar ventas
      const { data: sales, error: sError } = await supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(10);
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
    if (!confirm('⚠️ ATENCIÓN: Esto eliminará TODAS las ventas de Supabase. ¿Estás seguro?')) return;
    
    try {
      addLog('🗑️ Eliminando ventas de Supabase...');
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      // Eliminar primero los items (foreign key constraint)
      const { error: itemsError } = await supabase.from('sale_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (itemsError) throw itemsError;
      addLog('✅ Items de ventas eliminados');
      
      // Eliminar ventas
      const { error: salesError } = await supabase.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (salesError) throw salesError;
      addLog('✅ Ventas eliminadas de Supabase');
      
      // Marcar ventas locales como pendientes para re-sincronizar
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
      console.error('Clear error:', err);
    }
  }

  async function forceSyncAll() {
    if (!confirm('⚠️ ATENCIÓN: Esto marcará TODOS los productos y ventas locales como pendientes de sincronización. ¿Continuar?')) return;
    
    setIsRunning(true);
    setLogs([]);
    
    try {
      addLog('🔄 Forzando resincronización de todos los datos...');
      
      // Forzar productos - solo cambiar syncStatus, no tocar localId
      const allProducts = await db.products.toArray();
      let productsForced = 0;
      for (const product of allProducts) {
        await db.products.update(product.id!, {
          syncStatus: SyncStatus.PENDING,
          updatedAt: new Date(),
        });
        productsForced++;
      }
      addLog(`✅ ${productsForced} productos marcados como pendientes`);
      
      // Forzar ventas - solo cambiar syncStatus, no tocar localId
      const allSales = await db.sales.toArray();
      let salesForced = 0;
      for (const sale of allSales) {
        await db.sales.update(sale.id!, {
          syncStatus: SyncStatus.PENDING,
          updatedAt: new Date(),
        });
        salesForced++;
      }
      addLog(`✅ ${salesForced} ventas marcadas como pendientes`);
      
      // Forzar sale items - solo cambiar syncStatus, no tocar localId
      const allSaleItems = await db.saleItems.toArray();
      let itemsForced = 0;
      for (const item of allSaleItems) {
        await db.saleItems.update(item.id!, {
          syncStatus: SyncStatus.PENDING,
          updatedAt: new Date(),
        });
        itemsForced++;
      }
      addLog(`✅ ${itemsForced} items de ventas marcados como pendientes`);
      
      addLog('🎯 Todos los datos marcados como pendientes. Ejecutando sincronización...');
      
      // Ejecutar sincronización
      const result = await bidirectionalSync();
      
      if (result.success) {
        addLog(`✅ Sincronización exitosa!`);
        addLog(`   📤 Subidos: ${result.uploaded}`);
        addLog(`   📥 Descargados: ${result.downloaded}`);
      } else {
        addLog(`❌ Sincronización con errores:`);
        result.errors.forEach(err => addLog(`   - ${err}`));
      }
      
      // Actualizar estadísticas
      await loadDetailedStats();
      
    } catch (err: any) {
      addLog(`❌ Error: ${err.message}`);
      console.error('Force sync error:', err);
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">🔧 Diagnóstico de Sincronización</h1>
      
      {duplicates.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <p className="text-sm text-red-700">
            <strong>⚠️ Ventas Duplicadas Detectadas:</strong> Se encontraron {duplicates.length} ventas duplicadas en Supabase. 
            Esto puede causar problemas con los reportes. Usa "Limpiar Ventas Nube" para eliminarlas.
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer text-red-800 font-semibold hover:text-red-600">
              Ver detalles de duplicados ({duplicates.length})
            </summary>
            <ul className="mt-2 ml-4 text-sm text-red-700">
              {duplicates.map((d, i) => (
                <li key={i} className="mb-1">
                  - ID: <code>{d.id.substring(0, 8)}...</code> | Total: ${d.total} | {new Date(d.created_at).toLocaleString()}
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
        <p className="text-sm text-blue-700">
          <strong>💡 Información:</strong> Las ventas se sincronizan correctamente. Si ves más registros en Supabase que los esperados, 
          pueden ser ventas de prueba anteriores. Usa "Ver Estadísticas Detalladas" para analizar el estado actual y "Limpiar Ventas Nube" para eliminarlas.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-900 text-sm">Productos Locales</h3>
          <p className="text-2xl font-bold text-blue-600">{dbStats.products}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="font-semibold text-green-900 text-sm">Ventas Locales</h3>
          <p className="text-2xl font-bold text-green-600">{dbStats.sales}</p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <h3 className="font-semibold text-yellow-900 text-sm">Pendientes Sync</h3>
          <p className="text-2xl font-bold text-yellow-600">{dbStats.pending}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <h3 className="font-semibold text-purple-900 text-sm">Productos Nube</h3>
          <p className="text-2xl font-bold text-purple-600">{cloudStats.products}</p>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <h3 className="font-semibold text-orange-900 text-sm">Ventas Nube</h3>
          <p className="text-2xl font-bold text-orange-600">{cloudStats.sales}</p>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        <button
          onClick={testSync}
          disabled={isRunning}
          className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold"
        >
          {isRunning ? 'Ejecutando...' : '🔄 Probar Sincronización'}
        </button>
        
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={testSupabaseConnection}
            disabled={isRunning}
            className="bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 disabled:opacity-50"
          >
            🔌 Ver Datos en Nube
          </button>
          <button
            onClick={clearSupabaseSales}
            disabled={isRunning}
            className="bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            🧹 Limpiar Ventas Nube
          </button>
        </div>

        <button
          onClick={forceSyncAll}
          disabled={isRunning}
          className="w-full bg-red-600 text-white py-3 px-6 rounded-lg hover:bg-red-700 disabled:opacity-50 font-semibold"
        >
          ⚡ Forzar Sincronización de Todos los Datos
        </button>
        
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={loadDetailedStats}
            disabled={isRunning}
            className="bg-teal-600 text-white py-2 px-4 rounded-lg hover:bg-teal-700 disabled:opacity-50"
          >
            📊 Ver Estadísticas Detalladas
          </button>
          <button
            onClick={checkDuplicates}
            disabled={isRunning}
            className="bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            🔍 Buscar Duplicados
          </button>
        </div>

        <button
          onClick={loadFullDatabaseStats}
          disabled={isRunning}
          className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-semibold"
        >
          🗄️ Ver Toda la Base de Datos
        </button>
        
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={clearLocalData}
            disabled={isRunning}
            className="bg-orange-600 text-white py-2 px-4 rounded-lg hover:bg-orange-700 disabled:opacity-50"
          >
            🗑️ Limpiar Tablas Locales
          </button>
          <button
            onClick={resetDatabase}
            disabled={isRunning}
            className="bg-red-800 text-white py-2 px-4 rounded-lg hover:bg-red-900 disabled:opacity-50"
          >
            ⚠️ Reset Total DB
          </button>
        </div>
      </div>

      {showFullDb && fullDbStats && cloudCounts && (
        <div className="bg-white border border-gray-200 rounded-lg mb-6 overflow-hidden">
          <div className="bg-gray-100 px-4 py-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-800">📊 Estado Completo de la Base de Datos</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Tabla</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-600">Local</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-600">Nube</th>
                  <th className="px-4 py-2 text-center font-medium text-green-600">✅ Sync</th>
                  <th className="px-4 py-2 text-center font-medium text-yellow-600">⏳ Pend</th>
                  <th className="px-4 py-2 text-center font-medium text-red-600">❌ Error</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className={fullDbStats.products.local !== cloudCounts.products ? 'bg-yellow-50' : ''}>
                  <td className="px-4 py-2 font-medium">Products</td>
                  <td className="px-4 py-2 text-center">{fullDbStats.products.local}</td>
                  <td className="px-4 py-2 text-center">{cloudCounts.products}</td>
                  <td className="px-4 py-2 text-center text-green-600">{fullDbStats.products.synced}</td>
                  <td className="px-4 py-2 text-center text-yellow-600">{fullDbStats.products.pending}</td>
                  <td className="px-4 py-2 text-center text-red-600">{fullDbStats.products.error}</td>
                  <td className="px-4 py-2 text-center">
                    {fullDbStats.products.local === cloudCounts.products ? '✅' : '⚠️'}
                  </td>
                </tr>
                <tr className={fullDbStats.sales.local !== cloudCounts.sales ? 'bg-yellow-50' : ''}>
                  <td className="px-4 py-2 font-medium">Sales</td>
                  <td className="px-4 py-2 text-center">{fullDbStats.sales.local}</td>
                  <td className="px-4 py-2 text-center">{cloudCounts.sales}</td>
                  <td className="px-4 py-2 text-center text-green-600">{fullDbStats.sales.synced}</td>
                  <td className="px-4 py-2 text-center text-yellow-600">{fullDbStats.sales.pending}</td>
                  <td className="px-4 py-2 text-center text-red-600">{fullDbStats.sales.error}</td>
                  <td className="px-4 py-2 text-center">
                    {fullDbStats.sales.local === cloudCounts.sales ? '✅' : '⚠️'}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-medium">Sale Items</td>
                  <td className="px-4 py-2 text-center">{fullDbStats.saleItems.local}</td>
                  <td className="px-4 py-2 text-center">-</td>
                  <td className="px-4 py-2 text-center text-green-600">{fullDbStats.saleItems.synced}</td>
                  <td className="px-4 py-2 text-center text-yellow-600">{fullDbStats.saleItems.pending}</td>
                  <td className="px-4 py-2 text-center text-red-600">{fullDbStats.saleItems.error}</td>
                  <td className="px-4 py-2 text-center">-</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-medium">Payments</td>
                  <td className="px-4 py-2 text-center">{fullDbStats.payments.local}</td>
                  <td className="px-4 py-2 text-center">-</td>
                  <td className="px-4 py-2 text-center text-green-600">{fullDbStats.payments.synced}</td>
                  <td className="px-4 py-2 text-center text-yellow-600">{fullDbStats.payments.pending}</td>
                  <td className="px-4 py-2 text-center text-red-600">{fullDbStats.payments.error}</td>
                  <td className="px-4 py-2 text-center">-</td>
                </tr>
                <tr className={fullDbStats.customers.local > 0 && cloudCounts.customers === 0 ? 'bg-yellow-50' : ''}>
                  <td className="px-4 py-2 font-medium">Customers</td>
                  <td className="px-4 py-2 text-center">{fullDbStats.customers.local}</td>
                  <td className="px-4 py-2 text-center">{cloudCounts.customers}</td>
                  <td className="px-4 py-2 text-center text-green-600">{fullDbStats.customers.synced}</td>
                  <td className="px-4 py-2 text-center text-yellow-600">{fullDbStats.customers.pending}</td>
                  <td className="px-4 py-2 text-center text-red-600">{fullDbStats.customers.error}</td>
                  <td className="px-4 py-2 text-center">
                    {fullDbStats.customers.local === 0 ? '✅' : fullDbStats.customers.local === cloudCounts.customers ? '✅' : '❌'}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-medium">Exchange Rates</td>
                  <td className="px-4 py-2 text-center">{fullDbStats.exchangeRates.local}</td>
                  <td className="px-4 py-2 text-center">{cloudCounts.exchangeRates}</td>
                  <td className="px-4 py-2 text-center text-green-600">{fullDbStats.exchangeRates.synced}</td>
                  <td className="px-4 py-2 text-center text-yellow-600">{fullDbStats.exchangeRates.pending}</td>
                  <td className="px-4 py-2 text-center text-red-600">{fullDbStats.exchangeRates.error}</td>
                  <td className="px-4 py-2 text-center">-</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-medium">Inventory Movements</td>
                  <td className="px-4 py-2 text-center">{fullDbStats.inventoryMovements.local}</td>
                  <td className="px-4 py-2 text-center">-</td>
                  <td className="px-4 py-2 text-center text-green-600">{fullDbStats.inventoryMovements.synced}</td>
                  <td className="px-4 py-2 text-center text-yellow-600">{fullDbStats.inventoryMovements.pending}</td>
                  <td className="px-4 py-2 text-center text-red-600">{fullDbStats.inventoryMovements.error}</td>
                  <td className="px-4 py-2 text-center">-</td>
                </tr>
                <tr className={fullDbStats.gastosFijos.local !== cloudCounts.fixedExpenses ? 'bg-yellow-50' : ''}>
                  <td className="px-4 py-2 font-medium">Fixed Expenses</td>
                  <td className="px-4 py-2 text-center">{fullDbStats.gastosFijos.local}</td>
                  <td className="px-4 py-2 text-center">{cloudCounts.fixedExpenses}</td>
                  <td className="px-4 py-2 text-center text-green-600">{fullDbStats.gastosFijos.synced}</td>
                  <td className="px-4 py-2 text-center text-yellow-600">{fullDbStats.gastosFijos.pending}</td>
                  <td className="px-4 py-2 text-center text-red-600">{fullDbStats.gastosFijos.error}</td>
                  <td className="px-4 py-2 text-center">
                    {fullDbStats.gastosFijos.local === cloudCounts.fixedExpenses ? '✅' : '⚠️'}
                  </td>
                </tr>
                <tr className={fullDbStats.configuracionMetas.local !== cloudCounts.goalsConfiguration ? 'bg-yellow-50' : ''}>
                  <td className="px-4 py-2 font-medium">Goals Configuration</td>
                  <td className="px-4 py-2 text-center">{fullDbStats.configuracionMetas.local}</td>
                  <td className="px-4 py-2 text-center">{cloudCounts.goalsConfiguration}</td>
                  <td className="px-4 py-2 text-center text-green-600">{fullDbStats.configuracionMetas.synced}</td>
                  <td className="px-4 py-2 text-center text-yellow-600">{fullDbStats.configuracionMetas.pending}</td>
                  <td className="px-4 py-2 text-center text-red-600">{fullDbStats.configuracionMetas.error}</td>
                  <td className="px-4 py-2 text-center">
                    {fullDbStats.configuracionMetas.local === cloudCounts.goalsConfiguration ? '✅' : '⚠️'}
                  </td>
                </tr>
                <tr className={fullDbStats.historialVentasMeta.local !== cloudCounts.salesGoalsHistory ? 'bg-yellow-50' : ''}>
                  <td className="px-4 py-2 font-medium">Sales Goals History</td>
                  <td className="px-4 py-2 text-center">{fullDbStats.historialVentasMeta.local}</td>
                  <td className="px-4 py-2 text-center">{cloudCounts.salesGoalsHistory}</td>
                  <td className="px-4 py-2 text-center text-green-600">{fullDbStats.historialVentasMeta.synced}</td>
                  <td className="px-4 py-2 text-center text-yellow-600">{fullDbStats.historialVentasMeta.pending}</td>
                  <td className="px-4 py-2 text-center text-red-600">{fullDbStats.historialVentasMeta.error}</td>
                  <td className="px-4 py-2 text-center">
                    {fullDbStats.historialVentasMeta.local === cloudCounts.salesGoalsHistory ? '✅' : '⚠️'}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-medium">Config. Cambiaria</td>
                  <td className="px-4 py-2 text-center">{fullDbStats.configuracionCambiaria.local}</td>
                  <td className="px-4 py-2 text-center">-</td>
                  <td className="px-4 py-2 text-center text-green-600">{fullDbStats.configuracionCambiaria.synced}</td>
                  <td className="px-4 py-2 text-center text-yellow-600">{fullDbStats.configuracionCambiaria.pending}</td>
                  <td className="px-4 py-2 text-center text-red-600">{fullDbStats.configuracionCambiaria.error}</td>
                  <td className="px-4 py-2 text-center">❌</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-medium">Historial Tasas</td>
                  <td className="px-4 py-2 text-center">{fullDbStats.historialTasas.local}</td>
                  <td className="px-4 py-2 text-center">-</td>
                  <td className="px-4 py-2 text-center text-green-600">{fullDbStats.historialTasas.synced}</td>
                  <td className="px-4 py-2 text-center text-yellow-600">{fullDbStats.historialTasas.pending}</td>
                  <td className="px-4 py-2 text-center text-red-600">{fullDbStats.historialTasas.error}</td>
                  <td className="px-4 py-2 text-center">❌</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-medium">Cálculos Precios</td>
                  <td className="px-4 py-2 text-center">{fullDbStats.calculosPrecios.local}</td>
                  <td className="px-4 py-2 text-center">-</td>
                  <td className="px-4 py-2 text-center text-green-600">{fullDbStats.calculosPrecios.synced}</td>
                  <td className="px-4 py-2 text-center text-yellow-600">{fullDbStats.calculosPrecios.pending}</td>
                  <td className="px-4 py-2 text-center text-red-600">{fullDbStats.calculosPrecios.error}</td>
                  <td className="px-4 py-2 text-center">❌</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm h-96 overflow-y-auto">
        <h3 className="text-white font-semibold mb-2">📋 Log de Eventos:</h3>
        {logs.length === 0 ? (
          <p className="text-gray-500">Esperando acción...</p>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="mb-1">
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
