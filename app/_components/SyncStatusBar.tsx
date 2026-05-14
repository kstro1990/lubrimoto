'use client';

import { useState, useEffect, useRef } from 'react';
import { syncEvents, isOnline, bidirectionalSync, getSyncStats } from '../_lib/sync';
import { useNotifications } from './NotificationProvider';
import { RefreshCw, Cloud, CloudOff, Upload } from 'lucide-react';
import { TOKENS, PMBtnPrimary } from './_pmTheme';

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
        const msg =
          result.uploaded === 0 && result.downloaded === 0
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

  const iconColor = !online ? TOKENS.red : syncing ? TOKENS.charcoal : TOKENS.green;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Sincronización: ${statusLabel}`}
        aria-expanded={open}
        title={statusLabel}
        className="relative flex items-center justify-center w-10 h-10 rounded transition-colors"
        style={{
          background: '#fff',
          border: `1px solid ${TOKENS.slate200}`,
          color: iconColor,
          boxShadow: '0 1px 2px rgba(18, 24, 38, 0.04)',
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.background = TOKENS.slate100)
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.background = '#fff')
        }
      >
        {syncing ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : online ? (
          <Cloud className="w-4 h-4" />
        ) : (
          <CloudOff className="w-4 h-4" />
        )}
        {pendingCount > 0 && !syncing && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[10px] font-bold leading-none pm-tnum"
            style={{ background: TOKENS.orange, color: '#fff' }}
          >
            {pendingCount > 99 ? '99+' : pendingCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Detalles de sincronización"
          className="absolute top-full right-0 mt-2 z-50 w-72 p-3 rounded pm-elevated"
          style={{
            background: '#fff',
            border: `1px solid ${TOKENS.slate200}`,
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {online ? (
                <Cloud className="w-4 h-4" style={{ color: TOKENS.green }} />
              ) : (
                <CloudOff className="w-4 h-4" style={{ color: TOKENS.red }} />
              )}
              <span
                className="text-[13px] font-semibold"
                style={{ color: TOKENS.charcoal }}
              >
                {online ? 'En línea' : 'Sin conexión'}
              </span>
            </div>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider"
              style={{
                background: online ? TOKENS.greenSoft : TOKENS.redSoft,
                color: online ? TOKENS.green : TOKENS.red,
              }}
            >
              {online ? 'Online' : 'Offline'}
            </span>
          </div>

          <div
            className="pt-3 mb-3 space-y-2"
            style={{ borderTop: `1px solid ${TOKENS.slate200}` }}
          >
            <div className="flex justify-between text-[13px]">
              <span style={{ color: TOKENS.slate500 }}>Pendientes local:</span>
              <span
                className="font-bold pm-tnum flex items-center gap-1"
                style={{ color: TOKENS.charcoal }}
              >
                <Upload className="w-3 h-3" /> {pendingCount}
              </span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span style={{ color: TOKENS.slate500 }}>Última sync:</span>
              <span
                className="font-semibold pm-tnum"
                style={{ color: TOKENS.charcoal }}
              >
                {lastSync ? lastSync.toLocaleTimeString() : 'Nunca'}
              </span>
            </div>
          </div>

          <PMBtnPrimary
            onClick={handleSync}
            disabled={syncing || !online}
            className="w-full"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando…' : pendingCount > 0 ? `Sync (${pendingCount})` : 'Sync'}
          </PMBtnPrimary>

          {!online && (
            <p
              className="text-[11px] mt-2 text-center"
              style={{ color: TOKENS.red }}
            >
              Sin conexión. Los datos se sincronizarán al reconectar.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
