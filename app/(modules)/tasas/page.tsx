"use client";

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, HistorialTasa } from '@/app/_db/db';
import {
  Plus,
  TrendingUp,
  Calendar,
  Clock,
  Search,
  ArrowLeft,
  Trash2,
  Edit,
  RefreshCcw,
  TrendingDown,
  AlertCircle,
  Cloud,
  Wifi,
  WifiOff,
  DollarSign,
} from 'lucide-react';
import Link from 'next/link';
import { useNotifications } from '@/app/_components/NotificationProvider';
import { useSincronizacionTasas } from '@/app/_hooks/useSincronizacionTasas';
import { useTasas } from '@/app/_contexts/TasasContext';
import FormularioTasa from './components/FormularioTasa';
import HistorialGrafico from './components/HistorialGrafico';
import { TOKENS, PMBtnPrimary, PMBtnSecondary } from '@/app/_components/_pmTheme';

export default function TasasPage() {
  const { success, error: showError } = useNotifications();
  const { actualizarTasas } = useTasas();
  const {
    sincronizar,
    resultado,
    estaCargando,
    hayConexion,
    formatoTiempoTranscurrido,
    ultimaSincronizacion,
  } = useSincronizacionTasas();

  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTasa, setEditingTasa] = useState<HistorialTasa | null>(null);
  const [showHistorial, setShowHistorial] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [mostrarResultadoSync, setMostrarResultadoSync] = useState(false);

  const tasas = useLiveQuery(
    () => db.historialTasas.orderBy('fecha').reverse().toArray(),
    [],
  );

  const filteredTasas = React.useMemo(() => {
    if (!tasas) return [];
    let filtered = tasas;

    const now = new Date();
    if (dateFilter === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filtered = filtered.filter((t) => new Date(t.fecha) >= today);
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter((t) => new Date(t.fecha) >= weekAgo);
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter((t) => new Date(t.fecha) >= monthAgo);
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (t) =>
          t.fuente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.fecha.toLocaleDateString().includes(searchTerm),
      );
    }

    return filtered;
  }, [tasas, searchTerm, dateFilter]);

  const stats = React.useMemo(() => {
    if (!tasas || tasas.length === 0) return null;
    const latest = tasas[0];
    const previous = tasas[1];

    const bcvChange = previous
      ? ((latest.tasaBCV - previous.tasaBCV) / previous.tasaBCV) * 100
      : 0;
    const paraleloChange = previous
      ? ((latest.tasaParalelo - previous.tasaParalelo) / previous.tasaParalelo) * 100
      : 0;

    const avgBCV = tasas.reduce((sum, t) => sum + t.tasaBCV, 0) / tasas.length;
    const avgParalelo = tasas.reduce((sum, t) => sum + t.tasaParalelo, 0) / tasas.length;
    const avgBrecha = tasas.reduce((sum, t) => sum + t.brecha, 0) / tasas.length;

    return {
      latest,
      bcvChange,
      paraleloChange,
      avgBCV,
      avgParalelo,
      avgBrecha,
      totalRegistros: tasas.length,
    };
  }, [tasas]);

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar esta tasa?')) return;
    try {
      await db.historialTasas.delete(id);
      success('Tasa eliminada', 'El registro ha sido eliminado exitosamente');
    } catch {
      showError('Error', 'No se pudo eliminar la tasa');
    }
  };

  const handleEdit = (tasa: HistorialTasa) => {
    setEditingTasa(tasa);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingTasa(null);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString('es-VE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  const handleSincronizar = async () => {
    try {
      const resultado = await sincronizar();
      actualizarTasas(resultado.tasas);

      const { comparacion } = resultado;
      let mensaje = `BCV: Bs. ${resultado.tasas.bcv.toFixed(2)} | Paralelo: Bs. ${resultado.tasas.paralelo.toFixed(2)}`;

      if (comparacion.bcv.cambioPorcentaje !== 0) {
        const cambioBCV = comparacion.bcv.cambioPorcentaje;
        const simboloBCV = cambioBCV > 0 ? '↑' : '↓';
        mensaje += `\nBCV ${simboloBCV} ${Math.abs(cambioBCV).toFixed(2)}%`;
      }
      if (comparacion.paralelo.cambioPorcentaje !== 0) {
        const cambioPar = comparacion.paralelo.cambioPorcentaje;
        const simboloPar = cambioPar > 0 ? '↑' : '↓';
        mensaje += ` | Paralelo ${simboloPar} ${Math.abs(cambioPar).toFixed(2)}%`;
      }

      if (resultado.desdeCache) {
        success('Sincronización completada (Cache)', resultado.mensaje || 'Usando datos en caché');
      } else {
        success('Sincronización exitosa', mensaje);
      }

      setMostrarResultadoSync(true);
      setTimeout(() => setMostrarResultadoSync(false), 5000);
    } catch (err: any) {
      showError('Error de sincronización', err.message || 'No se pudo sincronizar con DolarApi');
    }
  };

  const filters = [
    { value: 'all', label: 'Todas' },
    { value: 'today', label: 'Hoy' },
    { value: 'week', label: 'Última semana' },
    { value: 'month', label: 'Último mes' },
  ] as const;

  return (
    <div className="min-h-screen">
      <div className="max-w-[1440px] mx-auto px-6 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/calculadora"
              className="inline-flex items-center justify-center h-9 w-9 rounded transition-colors"
              style={{
                background: '#fff',
                border: `1px solid ${TOKENS.slate200}`,
                color: TOKENS.slate500,
              }}
              aria-label="Volver a calculadora"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="pm-eyebrow mb-1">Finanzas / Tipo de Cambio</div>
              <div className="flex items-center gap-2.5">
                <div
                  className="flex items-center justify-center h-9 w-9 rounded"
                  style={{ background: TOKENS.charcoal, color: '#fff' }}
                >
                  <DollarSign className="h-4 w-4" />
                </div>
                <div>
                  <h1
                    className="text-[24px] font-bold leading-8 tracking-[-0.02em]"
                    style={{ color: TOKENS.charcoal }}
                  >
                    Gestión de Tasas Cambiarias
                  </h1>
                  <p className="text-[13px]" style={{ color: TOKENS.slate500 }}>
                    Administra el historial de tasas BCV y Paralelo
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <PMBtnSecondary onClick={() => setShowHistorial(!showHistorial)}>
              <TrendingUp className="h-4 w-4" />
              {showHistorial ? 'Ocultar Gráfico' : 'Ver Gráfico'}
            </PMBtnSecondary>
            <PMBtnSecondary
              onClick={() => {
                setEditingTasa(null);
                setShowForm(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Nueva Tasa
            </PMBtnSecondary>
            <PMBtnPrimary onClick={handleSincronizar} disabled={estaCargando}>
              {estaCargando ? (
                <span
                  className="inline-block w-3.5 h-3.5 rounded-full animate-spin"
                  style={{
                    border: '2px solid rgba(255,255,255,0.4)',
                    borderTopColor: '#fff',
                  }}
                />
              ) : hayConexion() ? (
                <Cloud className="h-4 w-4" />
              ) : (
                <WifiOff className="h-4 w-4" />
              )}
              {estaCargando ? 'Sincronizando…' : 'Sincronizar API'}
            </PMBtnPrimary>
          </div>
        </div>

        {/* Sync info bar */}
        <div
          className="flex items-center justify-between gap-3 px-4 py-2.5 rounded flex-wrap"
          style={{ background: '#fff', border: `1px solid ${TOKENS.slate200}` }}
        >
          <div className="flex items-center gap-3 text-[12px]" style={{ color: TOKENS.slate500 }}>
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider"
              style={{
                background: hayConexion() ? TOKENS.greenSoft : TOKENS.amberSoft,
                color: hayConexion() ? TOKENS.green : TOKENS.amber,
              }}
            >
              {hayConexion() ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {hayConexion() ? 'Online' : 'Offline'}
            </span>
            <span>
              Última sincronización:{' '}
              <span className="pm-tnum font-semibold" style={{ color: TOKENS.charcoal }}>
                {ultimaSincronizacion ? formatoTiempoTranscurrido() : 'Nunca'}
              </span>
            </span>
          </div>

          {mostrarResultadoSync && resultado && (
            <div className="flex items-center gap-4 text-[12px]">
              <SyncDelta
                label="BCV"
                value={`Bs. ${resultado.tasas.bcv.toFixed(2)}`}
                change={resultado.comparacion.bcv.cambioPorcentaje}
              />
              <SyncDelta
                label="Paralelo"
                value={`Bs. ${resultado.tasas.paralelo.toFixed(2)}`}
                change={resultado.comparacion.paralelo.cambioPorcentaje}
              />
              {resultado.desdeCache && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider"
                  style={{ background: TOKENS.amberSoft, color: TOKENS.amber }}
                >
                  Cache
                </span>
              )}
            </div>
          )}
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              label="Tasa BCV (Hoy)"
              value={`Bs. ${formatCurrency(stats.latest.tasaBCV)}`}
              change={stats.bcvChange}
            />
            <StatCard
              label="Tasa Paralelo (Hoy)"
              value={`Bs. ${formatCurrency(stats.latest.tasaParalelo)}`}
              change={stats.paraleloChange}
            />
            <BrechaCard latest={stats.latest.brecha} avg={stats.avgBrecha} />
            <div className="pm-card px-4 py-3">
              <div className="pm-eyebrow">Total Registros</div>
              <div
                className="pm-tnum text-[24px] font-bold leading-8 tracking-[-0.02em] mt-1"
                style={{ color: TOKENS.charcoal }}
              >
                {stats.totalRegistros}
              </div>
              <div className="text-[12px] mt-0.5" style={{ color: TOKENS.slate500 }}>
                BCV prom: Bs. {formatCurrency(stats.avgBCV)}
              </div>
            </div>
          </div>
        )}

        {/* Gráfico */}
        {showHistorial && tasas && <HistorialGrafico tasas={tasas.slice(0, 30).reverse()} />}

        {/* Filtros */}
        <div
          className="rounded p-3 flex flex-col md:flex-row gap-3 items-center justify-between"
          style={{ background: '#fff', border: `1px solid ${TOKENS.slate200}` }}
        >
          <div className="flex gap-1 flex-wrap">
            {filters.map((f) => {
              const active = dateFilter === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setDateFilter(f.value)}
                  className="px-3 h-8 rounded text-[12px] font-semibold transition-colors"
                  style={{
                    background: active ? TOKENS.charcoal : 'transparent',
                    color: active ? '#fff' : TOKENS.charcoal,
                    border: `1px solid ${active ? TOKENS.charcoal : TOKENS.slate200}`,
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:w-64">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
              style={{ color: TOKENS.slate400 }}
            />
            <input
              type="text"
              placeholder="Buscar por fecha o fuente…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pm-input"
              style={{ paddingLeft: '2.25rem' }}
            />
          </div>
        </div>

        {/* Tabla */}
        <div className="pm-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-[13px]">
              <thead className="sticky top-0 z-10">
                <tr style={{ background: TOKENS.slate100 }}>
                  <Th>Fecha y hora</Th>
                  <Th align="right">Tasa BCV</Th>
                  <Th align="right">Tasa Paralelo</Th>
                  <Th align="right">Brecha</Th>
                  <Th>Fuente</Th>
                  <Th align="right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {!filteredTasas || filteredTasas.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-12 text-center"
                      style={{ color: TOKENS.slate500 }}
                    >
                      <TrendingUp
                        className="h-10 w-10 mx-auto mb-3"
                        style={{ color: TOKENS.slate300 }}
                      />
                      <p className="text-[14px] font-semibold mb-1">
                        No hay tasas registradas
                      </p>
                      <p className="text-[12px]">
                        Comienza agregando tu primera tasa cambiaria
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredTasas.map((tasa) => (
                    <tr
                      key={tasa.id}
                      style={{ borderTop: `1px solid ${TOKENS.slate200}` }}
                    >
                      <Td>
                        <div className="flex items-center gap-2">
                          <Calendar
                            className="h-3.5 w-3.5"
                            style={{ color: TOKENS.slate400 }}
                          />
                          <div>
                            <div
                              className="text-[13px] font-semibold pm-tnum"
                              style={{ color: TOKENS.charcoal }}
                            >
                              {formatDate(tasa.fecha)}
                            </div>
                            <div
                              className="text-[11px] flex items-center gap-1 pm-tnum"
                              style={{ color: TOKENS.slate500 }}
                            >
                              <Clock className="h-2.5 w-2.5" />
                              {tasa.hora}
                            </div>
                          </div>
                        </div>
                      </Td>
                      <Td align="right">
                        <span className="pm-tnum font-semibold" style={{ color: TOKENS.charcoal }}>
                          Bs. {formatCurrency(tasa.tasaBCV)}
                        </span>
                      </Td>
                      <Td align="right">
                        <span className="pm-tnum font-semibold" style={{ color: TOKENS.charcoal }}>
                          Bs. {formatCurrency(tasa.tasaParalelo)}
                        </span>
                      </Td>
                      <Td align="right">
                        <BrechaBadge brecha={tasa.brecha} />
                      </Td>
                      <Td>
                        <span
                          className="text-[11px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                          style={{ background: TOKENS.slate100, color: TOKENS.slate500 }}
                        >
                          {tasa.fuente || 'Manual'}
                        </span>
                      </Td>
                      <Td align="right">
                        <div className="flex items-center justify-end gap-1">
                          <IconBtn onClick={() => handleEdit(tasa)} title="Editar">
                            <Edit className="h-3.5 w-3.5" />
                          </IconBtn>
                          <IconBtn
                            onClick={() => tasa.id && handleDelete(tasa.id)}
                            title="Eliminar"
                            danger
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </IconBtn>
                        </div>
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showForm && (
          <FormularioTasa
            tasa={editingTasa}
            onClose={() => {
              setShowForm(false);
              setEditingTasa(null);
            }}
            onSuccess={handleFormSuccess}
          />
        )}
      </div>
    </div>
  );
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.05em] select-none"
      style={{
        color: TOKENS.slate700,
        borderBottom: `1px solid ${TOKENS.slate200}`,
        textAlign: align,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <td
      className="px-3 py-2.5 align-middle"
      style={{ textAlign: align, color: TOKENS.charcoal }}
    >
      {children}
    </td>
  );
}

function StatCard({
  label,
  value,
  change,
}: {
  label: string;
  value: string;
  change: number;
}) {
  const positive = change >= 0;
  return (
    <div className="pm-card px-4 py-3">
      <div className="pm-eyebrow">{label}</div>
      <div
        className="pm-tnum text-[20px] font-bold leading-7 tracking-[-0.01em] mt-1"
        style={{ color: TOKENS.charcoal }}
      >
        {value}
      </div>
      <div
        className="flex items-center gap-1 mt-1 text-[12px] pm-tnum"
        style={{ color: positive ? TOKENS.green : TOKENS.red }}
      >
        {positive ? (
          <TrendingUp className="h-3 w-3" />
        ) : (
          <TrendingDown className="h-3 w-3" />
        )}
        {positive ? '+' : ''}
        {change.toFixed(2)}%
      </div>
    </div>
  );
}

function BrechaCard({ latest, avg }: { latest: number; avg: number }) {
  const high = latest > 5;
  return (
    <div
      className="rounded px-4 py-3"
      style={{
        background: '#fff',
        border: `1px solid ${TOKENS.slate200}`,
        borderLeft: `3px solid ${high ? TOKENS.red : TOKENS.green}`,
      }}
    >
      <div className="pm-eyebrow">Brecha Actual</div>
      <div
        className="pm-tnum text-[20px] font-bold leading-7 tracking-[-0.01em] mt-1"
        style={{ color: high ? TOKENS.red : TOKENS.green }}
      >
        {latest.toFixed(2)}%
      </div>
      <div
        className="text-[12px] mt-0.5 pm-tnum"
        style={{ color: TOKENS.slate500 }}
      >
        Promedio: {avg.toFixed(2)}%
      </div>
    </div>
  );
}

function BrechaBadge({ brecha }: { brecha: number }) {
  let tone: { bg: string; fg: string } = { bg: TOKENS.greenSoft, fg: TOKENS.green };
  if (brecha > 5) tone = { bg: TOKENS.redSoft, fg: TOKENS.red };
  else if (brecha > 2) tone = { bg: TOKENS.amberSoft, fg: TOKENS.amber };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider pm-tnum"
      style={{ background: tone.bg, color: tone.fg }}
    >
      {brecha.toFixed(2)}%
    </span>
  );
}

function SyncDelta({
  label,
  value,
  change,
}: {
  label: string;
  value: string;
  change: number;
}) {
  const color = change > 0 ? TOKENS.green : change < 0 ? TOKENS.red : TOKENS.slate500;
  return (
    <div className="flex items-center gap-1.5">
      <span className="pm-eyebrow">{label}:</span>
      <span className="pm-tnum font-bold" style={{ color }}>
        {value}
      </span>
      {change !== 0 && (
        <span className="text-[11px] pm-tnum" style={{ color }}>
          {change > 0 ? '↑' : '↓'} {Math.abs(change).toFixed(2)}%
        </span>
      )}
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="inline-flex items-center justify-center h-7 w-7 rounded transition-colors"
      style={{ color: danger ? TOKENS.red : TOKENS.slate500 }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLButtonElement).style.background = danger
          ? TOKENS.redSoft
          : TOKENS.slate100)
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')
      }
    >
      {children}
    </button>
  );
}
