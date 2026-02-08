'use client';

import { useState, useEffect } from 'react';
import { syncEvents, isOnline, bidirectionalSync, getSyncStats } from '../_lib/sync';
import { useNotifications } from './NotificationProvider';
import { RefreshCw, Cloud, CloudOff, Upload } from 'lucide-react';

export default function SyncStatusBar() {
  const [online, setOnline] = useState(isOnline());
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const { success, error: showError } = useNotifications();

  useEffect(() => {
    updateSyncStats();
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    syncEvents.on('online', handleOnline);
    syncEvents.on('offline', handleOffline);
    syncEvents.on('sync-start', () => setSyncing(true));
    syncEvents.on('sync-complete', () => {
      setSyncing(false);
      updateSyncStats();
    });
    syncEvents.on('sync-error', () => setSyncing(false));
    const interval = setInterval(() => setOnline(isOnline()), 5000);
    return () => {
      syncEvents.off('online', handleOnline);
      syncEvents.off('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  async function updateSyncStats() {
    const stats = await getSyncStats();
    setPendingCount(stats.totalPending);
    setLastSync(stats.lastSync);
  }

  async function handleSync() {
    if (!online) {
      showError('Sin Conexión', 'No hay conexión a internet para sincronizar', 5000);
      return;
    }
    setSyncing(true);
    try {
      const result = await bidirectionalSync();
      if (result.success) {
        const msg = result.uploaded === 0 && result.downloaded === 0
          ? 'Todo está actualizado. No hay cambios pendientes.'
          : `Sincronización completada: ${result.uploaded} subidos, ${result.downloaded} descargados`;
        success('Sincronización Exitosa', msg, 5000);
      } else {
        showError('Error de Sincronización', result.errors.join(', '), 8000);
      }
    } catch (err: any) {
      showError('Error', err?.message || 'No se pudo completar la sincronización', 8000);
    } finally {
      setSyncing(false);
      await updateSyncStats();
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-white rounded-lg shadow-lg border p-3 min-w-[300px]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {online ? <Cloud className="w-4 h-4 text-green-500" /> : <CloudOff className="w-4 h-4 text-red-500" />}
            <span className={`text-sm font-medium ${online ? 'text-green-600' : 'text-red-600'}`}>
              {online ? 'En línea' : 'Sin conexión'}
            </span>
          </div>
          <button onClick={() => setShowDetails(!showDetails)} className="text-xs text-gray-500 hover:text-gray-700">
            {showDetails ? 'Ocultar' : 'Detalles'}
          </button>
        </div>
        {showDetails && (
          <div className="border-t pt-2 mb-2 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Pendientes local:</span>
              <span className="font-medium flex items-center gap-1">
                <Upload className="w-3 h-3" /> {pendingCount} items
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Última sync:</span>
              <span className="font-medium">{lastSync ? lastSync.toLocaleTimeString() : 'Nunca'}</span>
            </div>
          </div>
        )}
        <button
          onClick={handleSync}
          disabled={syncing || !online}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          title="Sincronizar datos locales con la nube (subir y descargar)"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Sincronizando...' : pendingCount > 0 ? `Sync (${pendingCount})` : 'Sync'}
        </button>
        {!online && (
          <p className="text-xs text-red-500 mt-2 text-center">
            Sin conexión. Los datos se sincronizarán automáticamente al reconectar.
          </p>
        )}
      </div>
    </div>
  );
}
