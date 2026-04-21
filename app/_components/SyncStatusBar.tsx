'use client';

import { useState, useEffect, useRef } from 'react';
import { syncEvents, isOnline, bidirectionalSync, getSyncStats } from '../_lib/sync';
import { useNotifications } from './NotificationProvider';
import { RefreshCw, Cloud, CloudOff, Upload } from 'lucide-react';

export default function SyncStatusBar() {
  const [online, setOnline] = useState(isOnline());
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [open, setOpen] = useState(false);
  const { success, error: showError } = useNotifications();
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Close popover on outside click — same pattern as ProductSearch.
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

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

  const statusLabel = !online
    ? 'Sin conexión'
    : syncing
    ? 'Sincronizando…'
    : pendingCount > 0
    ? `${pendingCount} pendientes`
    : 'Sincronizado';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Sincronización: ${statusLabel}`}
        aria-expanded={open}
        title={statusLabel}
        className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
      >
        {syncing ? (
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400" />
        ) : online ? (
          <Cloud className="w-5 h-5 text-green-600 dark:text-green-400" />
        ) : (
          <CloudOff className="w-5 h-5 text-red-600 dark:text-red-400" />
        )}
        {pendingCount > 0 && !syncing && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-semibold leading-none"
          >
            {pendingCount > 99 ? '99+' : pendingCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Detalles de sincronización"
          className="absolute top-full right-0 mt-2 z-50 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3"
        >
          <div className="flex items-center gap-2 mb-3">
            {online ? (
              <Cloud className="w-4 h-4 text-green-500" />
            ) : (
              <CloudOff className="w-4 h-4 text-red-500" />
            )}
            <span
              className={`text-sm font-medium ${
                online ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}
            >
              {online ? 'En línea' : 'Sin conexión'}
            </span>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mb-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Pendientes local:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1">
                <Upload className="w-3 h-3" /> {pendingCount} items
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Última sync:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {lastSync ? lastSync.toLocaleTimeString() : 'Nunca'}
              </span>
            </div>
          </div>

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
      )}
    </div>
  );
}
