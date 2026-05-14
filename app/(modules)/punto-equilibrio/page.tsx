"use client";

import React, { useState } from 'react';
import {
  Target,
  TrendingUp,
  DollarSign,
  Calendar,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  AlertCircle,
  BarChart3,
  X,
} from 'lucide-react';
import { usePuntoEquilibrio } from '@/app/_hooks/usePuntoEquilibrio';
import { useNotifications } from '@/app/_components/NotificationProvider';
import { GastoFijo } from '@/app/_db/db';
import {
  PMScope,
  TOKENS,
  PMBtnPrimary,
  PMBtnSecondary,
} from '@/app/_components/_pmTheme';

export default function PuntoEquilibrioPage() {
  const {
    estado,
    cargando,
    error,
    guardarGastoFijo,
    actualizarGastoFijo,
    eliminarGastoFijo,
    guardarConfiguracionMeta,
    formatearUSD,
    formatearPorcentaje,
  } = usePuntoEquilibrio();

  const { success, error: showError } = useNotifications();

  const [showGastoForm, setShowGastoForm] = useState(false);
  const [editingGasto, setEditingGasto] = useState<GastoFijo | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'gastos' | 'config'>('dashboard');

  const [gastoForm, setGastoForm] = useState<{
    nombre: string;
    montoUSD: number;
    categoria: 'fijo' | 'variable';
    frecuencia: 'mensual' | 'semanal' | 'diario';
    notas: string;
  }>({
    nombre: '',
    montoUSD: 0,
    categoria: 'fijo',
    frecuencia: 'mensual',
    notas: '',
  });

  const [metaForm, setMetaForm] = useState({
    utilidadDeseadaUSD: 0,
    margenPromedioEsperado: 30,
    diasLaborales: 26,
  });

  const handleSaveGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingGasto?.id) {
        await actualizarGastoFijo(editingGasto.id, {
          ...gastoForm,
          updatedAt: new Date(),
        });
        success('Gasto actualizado', 'El gasto fijo ha sido actualizado');
      } else {
        const now = new Date();
        await guardarGastoFijo({
          ...gastoForm,
          activo: true,
          fechaInicio: now,
          createdAt: now,
          updatedAt: now,
        });
        success('Gasto agregado', 'El gasto fijo ha sido registrado exitosamente');
      }
      setShowGastoForm(false);
      setEditingGasto(null);
      setGastoForm({
        nombre: '',
        montoUSD: 0,
        categoria: 'fijo',
        frecuencia: 'mensual',
        notas: '',
      });
    } catch (err: any) {
      showError('Error', `No se pudo guardar el gasto: ${err.message}`);
    }
  };

  const handleSaveMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await guardarConfiguracionMeta(
        metaForm.utilidadDeseadaUSD,
        metaForm.margenPromedioEsperado,
        metaForm.diasLaborales,
      );
      success('Configuración guardada', 'La meta del mes ha sido configurada');
    } catch {
      showError('Error', 'No se pudo guardar la configuración');
    }
  };

  const handleDeleteGasto = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este gasto?')) return;
    try {
      await eliminarGastoFijo(id);
      success('Gasto eliminado', 'El gasto ha sido eliminado');
    } catch {
      showError('Error', 'No se pudo eliminar el gasto');
    }
  };

  const fechaActual = new Date();
  const nombreMes = fechaActual.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-10 w-10 mx-auto mb-3"
            style={{
              border: `3px solid ${TOKENS.slate200}`,
              borderTopColor: TOKENS.orange,
            }}
          />
          <p className="text-[13px]" style={{ color: TOKENS.slate500 }}>
            Calculando métricas…
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <div className="max-w-2xl mx-auto p-8">
          <div
            className="rounded p-6 text-center"
            style={{ background: TOKENS.redSoft, border: `1px solid ${TOKENS.red}` }}
          >
            <AlertCircle
              className="h-10 w-10 mx-auto mb-3"
              style={{ color: TOKENS.red }}
            />
            <h2 className="text-[16px] font-bold mb-1" style={{ color: TOKENS.red }}>
              Error al cargar datos
            </h2>
            <p className="text-[13px]" style={{ color: TOKENS.red }}>
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { calculos, progreso, gastosFijos } = estado;

  const tabs = [
    { value: 'dashboard', label: 'Dashboard' },
    { value: 'gastos', label: 'Gastos' },
    { value: 'config', label: 'Configuración' },
  ] as const;

  return (
    <div className="min-h-screen">
      <div className="max-w-[1440px] mx-auto px-6 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="pm-eyebrow mb-1">Finanzas / Meta Mensual</div>
            <div className="flex items-center gap-2.5">
              <div
                className="flex items-center justify-center h-9 w-9 rounded"
                style={{ background: TOKENS.charcoal, color: '#fff' }}
              >
                <Target className="h-4 w-4" />
              </div>
              <div>
                <h1
                  className="text-[24px] font-bold leading-8 tracking-[-0.02em]"
                  style={{ color: TOKENS.charcoal }}
                >
                  Punto de Equilibrio
                </h1>
                <p
                  className="text-[13px] capitalize"
                  style={{ color: TOKENS.slate500 }}
                >
                  {nombreMes}
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div
            className="inline-flex p-1 rounded"
            style={{
              background: '#fff',
              border: `1px solid ${TOKENS.slate200}`,
            }}
          >
            {tabs.map((tab) => {
              const active = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className="px-3 h-8 rounded text-[12px] font-semibold transition-colors"
                  style={{
                    background: active ? TOKENS.charcoal : 'transparent',
                    color: active ? '#fff' : TOKENS.slate500,
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dashboard tab */}
        {activeTab === 'dashboard' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Punto de Equilibrio */}
              <KpiCard
                label="Punto de Equilibrio"
                value={formatearUSD(calculos.puntoEquilibrio)}
                icon={<TrendingUp className="h-4 w-4" />}
                hint="Ventas mínimas para cubrir costos"
                footer={
                  progreso.ventasMesActual >= calculos.puntoEquilibrio ? (
                    <span
                      className="inline-flex items-center gap-1 text-[12px] font-bold"
                      style={{ color: TOKENS.green }}
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Alcanzado
                    </span>
                  ) : undefined
                }
              />

              {/* Meta Mensual */}
              <div className="pm-card px-4 py-3">
                <div className="pm-eyebrow flex items-center justify-between">
                  <span>Meta Mensual</span>
                  <Target className="h-3.5 w-3.5" style={{ color: TOKENS.slate400 }} />
                </div>
                <div
                  className="pm-tnum text-[24px] font-bold leading-8 tracking-[-0.02em] mt-1"
                  style={{ color: TOKENS.charcoal }}
                >
                  {formatearUSD(calculos.metaMensual)}
                </div>
                <div className="text-[12px] mt-0.5" style={{ color: TOKENS.slate500 }}>
                  Incluye utilidad deseada
                </div>
                <div className="mt-3">
                  <div
                    className="flex justify-between text-[11px] mb-1 pm-tnum"
                    style={{ color: TOKENS.slate500 }}
                  >
                    <span>Progreso</span>
                    <span className="font-bold">
                      {formatearPorcentaje(progreso.porcentajeCumplimiento)}
                    </span>
                  </div>
                  <div
                    className="h-2 rounded overflow-hidden"
                    style={{ background: TOKENS.slate100 }}
                  >
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${Math.min(progreso.porcentajeCumplimiento, 100)}%`,
                        background:
                          progreso.porcentajeCumplimiento >= 100
                            ? TOKENS.green
                            : TOKENS.orange,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Meta Diaria */}
              <KpiCard
                label="Meta Diaria"
                value={formatearUSD(calculos.metaDiaria)}
                icon={<Calendar className="h-4 w-4" />}
                hint="Promedio por día laboral"
                footer={
                  progreso.metaDiariaCumplida ? (
                    <span
                      className="inline-flex items-center gap-1 text-[12px] font-bold"
                      style={{ color: TOKENS.green }}
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Hoy: {formatearUSD(progreso.ventasHoy)}
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 text-[12px]"
                      style={{ color: TOKENS.amber }}
                    >
                      <AlertCircle className="h-3.5 w-3.5" />
                      Hoy: {formatearUSD(progreso.ventasHoy)}
                    </span>
                  )
                }
              />
            </div>

            {/* Progress block */}
            <section className="pm-card p-5">
              <h3 className="pm-section-title">
                <BarChart3 className="h-4 w-4" style={{ color: TOKENS.slate500 }} />
                Progreso del Mes
              </h3>

              <div className="flex justify-between items-end gap-4 flex-wrap">
                <div>
                  <div className="pm-eyebrow">Ventas del mes</div>
                  <div
                    className="pm-tnum text-[28px] font-bold leading-9 tracking-[-0.02em] mt-0.5"
                    style={{ color: TOKENS.charcoal }}
                  >
                    {formatearUSD(progreso.ventasMesActual)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="pm-eyebrow">Meta</div>
                  <div
                    className="pm-tnum text-[20px] font-bold leading-7 tracking-[-0.01em] mt-0.5"
                    style={{ color: TOKENS.slate500 }}
                  >
                    {formatearUSD(calculos.metaMensual)}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div
                  className="flex justify-between mb-1.5 text-[11px] pm-tnum"
                  style={{ color: TOKENS.slate500 }}
                >
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider"
                    style={{
                      background:
                        progreso.porcentajeCumplimiento >= 100
                          ? TOKENS.greenSoft
                          : progreso.porcentajeCumplimiento >= 50
                          ? TOKENS.orangeSoft
                          : TOKENS.amberSoft,
                      color:
                        progreso.porcentajeCumplimiento >= 100
                          ? TOKENS.green
                          : progreso.porcentajeCumplimiento >= 50
                          ? TOKENS.orange
                          : TOKENS.amber,
                    }}
                  >
                    {formatearPorcentaje(progreso.porcentajeCumplimiento)}
                  </span>
                  <span>Faltan: {formatearUSD(progreso.faltanteParaMeta)}</span>
                </div>
                <div
                  className="h-3 rounded overflow-hidden"
                  style={{ background: TOKENS.slate100 }}
                >
                  <div
                    style={{
                      width: `${Math.min(progreso.porcentajeCumplimiento, 100)}%`,
                      background:
                        progreso.porcentajeCumplimiento >= 100
                          ? TOKENS.green
                          : progreso.porcentajeCumplimiento >= 50
                          ? `linear-gradient(90deg, ${TOKENS.charcoal}, ${TOKENS.orange})`
                          : TOKENS.amber,
                      transition: 'width 500ms',
                    }}
                    className="h-full"
                  />
                </div>
              </div>

              <div
                className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 mt-4"
                style={{ borderTop: `1px solid ${TOKENS.slate200}` }}
              >
                <MicroStat label="Días restantes" value={progreso.diasRestantes.toString()} />
                <MicroStat
                  label="Margen promedio"
                  value={formatearPorcentaje(calculos.margenPromedio)}
                />
                <MicroStat
                  label="Proyección final"
                  value={formatearUSD(progreso.proyeccionFinal)}
                  tone={
                    progreso.proyeccionFinal >= calculos.metaMensual ? 'success' : 'danger'
                  }
                />
                <MicroStat
                  label="Costos fijos"
                  value={formatearUSD(calculos.costosFijosTotales)}
                />
              </div>
            </section>

            {/* Resumen gastos */}
            <section className="pm-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="pm-section-title m-0" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                  <DollarSign className="h-4 w-4" style={{ color: TOKENS.slate500 }} />
                  Resumen de Gastos Fijos
                </h3>
                <button
                  onClick={() => setActiveTab('gastos')}
                  className="text-[12px] font-semibold"
                  style={{ color: TOKENS.orange }}
                >
                  Ver todos →
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MicroStat
                  label="Total gastos"
                  value={formatearUSD(calculos.costosFijosTotales)}
                />
                <MicroStat label="Cantidad" value={gastosFijos.length.toString()} />
                <MicroStat
                  label="Fijos"
                  value={gastosFijos.filter((g) => g.categoria === 'fijo').length.toString()}
                />
                <MicroStat
                  label="Variables"
                  value={gastosFijos
                    .filter((g) => g.categoria === 'variable')
                    .length.toString()}
                />
              </div>
            </section>
          </>
        )}

        {/* Gastos tab */}
        {activeTab === 'gastos' && (
          <section className="pm-card overflow-hidden">
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{
                borderBottom: `1px solid ${TOKENS.slate200}`,
                background: TOKENS.slate50,
              }}
            >
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" style={{ color: TOKENS.slate500 }} />
                <span className="pm-eyebrow" style={{ color: TOKENS.slate700 }}>
                  Gestión de gastos fijos
                </span>
              </div>
              <PMBtnPrimary
                onClick={() => {
                  setEditingGasto(null);
                  setGastoForm({
                    nombre: '',
                    montoUSD: 0,
                    categoria: 'fijo',
                    frecuencia: 'mensual',
                    notas: '',
                  });
                  setShowGastoForm(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Agregar Gasto
              </PMBtnPrimary>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-[13px]">
                <thead className="sticky top-0 z-10">
                  <tr style={{ background: TOKENS.slate100 }}>
                    <Th>Concepto</Th>
                    <Th align="right">Monto</Th>
                    <Th>Categoría</Th>
                    <Th>Frecuencia</Th>
                    <Th align="right">Acciones</Th>
                  </tr>
                </thead>
                <tbody>
                  {gastosFijos.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-12 text-center"
                        style={{ color: TOKENS.slate500 }}
                      >
                        <DollarSign
                          className="h-10 w-10 mx-auto mb-3"
                          style={{ color: TOKENS.slate300 }}
                        />
                        <p className="text-[13px]">No hay gastos registrados</p>
                      </td>
                    </tr>
                  ) : (
                    gastosFijos.map((gasto) => (
                      <tr
                        key={gasto.id}
                        style={{ borderTop: `1px solid ${TOKENS.slate200}` }}
                      >
                        <Td>
                          <div
                            className="font-semibold"
                            style={{ color: TOKENS.charcoal }}
                          >
                            {gasto.nombre}
                          </div>
                          {gasto.notas && (
                            <div
                              className="text-[11px] mt-0.5"
                              style={{ color: TOKENS.slate500 }}
                            >
                              {gasto.notas}
                            </div>
                          )}
                        </Td>
                        <Td align="right">
                          <span
                            className="pm-tnum font-bold"
                            style={{ color: TOKENS.charcoal }}
                          >
                            {formatearUSD(gasto.montoUSD)}
                          </span>
                        </Td>
                        <Td>
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider"
                            style={{
                              background:
                                gasto.categoria === 'fijo'
                                  ? TOKENS.slate100
                                  : TOKENS.orangeSoft,
                              color:
                                gasto.categoria === 'fijo'
                                  ? TOKENS.charcoal
                                  : TOKENS.orange,
                            }}
                          >
                            {gasto.categoria === 'fijo' ? 'Fijo' : 'Variable'}
                          </span>
                        </Td>
                        <Td>
                          <span className="capitalize" style={{ color: TOKENS.slate700 }}>
                            {gasto.frecuencia}
                          </span>
                        </Td>
                        <Td align="right">
                          <div className="flex justify-end gap-1">
                            <IconBtn
                              onClick={() => {
                                setEditingGasto(gasto);
                                setGastoForm({
                                  nombre: gasto.nombre,
                                  montoUSD: gasto.montoUSD,
                                  categoria: gasto.categoria,
                                  frecuencia: gasto.frecuencia,
                                  notas: gasto.notas || '',
                                });
                                setShowGastoForm(true);
                              }}
                              title="Editar"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </IconBtn>
                            <IconBtn
                              onClick={() => gasto.id && handleDeleteGasto(gasto.id)}
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
          </section>
        )}

        {/* Config tab */}
        {activeTab === 'config' && (
          <section className="pm-card p-5 max-w-2xl">
            <h3 className="pm-section-title">Configuración de Metas</h3>

            <form onSubmit={handleSaveMeta} className="space-y-4">
              <div>
                <label className="pm-label">Utilidad Deseada (USD)</label>
                <input
                  type="number"
                  value={metaForm.utilidadDeseadaUSD}
                  onChange={(e) =>
                    setMetaForm({
                      ...metaForm,
                      utilidadDeseadaUSD: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="pm-input pm-tnum"
                  placeholder="5000"
                  step="0.01"
                />
                <p className="pm-hint">Ganancia neta que deseas obtener este mes</p>
              </div>

              <div>
                <label className="pm-label">Margen Promedio Esperado (%)</label>
                <input
                  type="number"
                  value={metaForm.margenPromedioEsperado}
                  onChange={(e) =>
                    setMetaForm({
                      ...metaForm,
                      margenPromedioEsperado: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="pm-input pm-tnum"
                  placeholder="30"
                  min="1"
                  max="100"
                />
                <p className="pm-hint">
                  Promedio actual: {formatearPorcentaje(calculos.margenPromedio)}
                </p>
              </div>

              <div>
                <label className="pm-label">Días Laborales del Mes</label>
                <input
                  type="number"
                  value={metaForm.diasLaborales}
                  onChange={(e) =>
                    setMetaForm({
                      ...metaForm,
                      diasLaborales: parseInt(e.target.value) || 26,
                    })
                  }
                  className="pm-input pm-tnum"
                  placeholder="26"
                  min="1"
                  max="31"
                />
              </div>

              <PMBtnPrimary type="submit" className="w-full h-10">
                Guardar Configuración
              </PMBtnPrimary>
            </form>

            {estado.meta && (
              <div
                className="mt-6 p-4 rounded"
                style={{
                  background: TOKENS.slate50,
                  border: `1px solid ${TOKENS.slate200}`,
                }}
              >
                <h4 className="pm-eyebrow mb-2">Configuración actual</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[13px]">
                  <ConfRow
                    label="Utilidad deseada"
                    value={formatearUSD(estado.meta.utilidadDeseadaUSD)}
                  />
                  <ConfRow
                    label="Margen esperado"
                    value={formatearPorcentaje(estado.meta.margenPromedioEsperado)}
                  />
                  <ConfRow
                    label="Días laborales"
                    value={estado.meta.diasLaborales.toString()}
                  />
                  <ConfRow
                    label="Punto de equilibrio"
                    value={formatearUSD(estado.meta.puntoEquilibrioCalculado)}
                  />
                  <ConfRow
                    label="Meta mensual"
                    value={formatearUSD(estado.meta.metaMensualCalculada)}
                  />
                  <ConfRow
                    label="Meta diaria"
                    value={formatearUSD(estado.meta.metaDiariaCalculada)}
                  />
                </div>
              </div>
            )}
          </section>
        )}

        {/* Gasto Modal */}
        {showGastoForm && (
          <PMScope className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <div
                className="fixed inset-0"
                style={{ background: 'rgba(18, 24, 38, 0.55)' }}
                onClick={() => setShowGastoForm(false)}
              />
              <div
                className="relative overflow-hidden rounded w-full max-w-md pm-elevated"
                style={{ background: '#fff', border: `1px solid ${TOKENS.slate200}` }}
              >
                <div
                  className="px-5 py-3 flex justify-between items-center"
                  style={{
                    background: TOKENS.slate50,
                    borderBottom: `1px solid ${TOKENS.slate200}`,
                  }}
                >
                  <div>
                    <div className="pm-eyebrow">
                      {editingGasto ? 'Editar registro' : 'Nuevo registro'}
                    </div>
                    <h3
                      className="text-[16px] font-semibold leading-5"
                      style={{ color: TOKENS.charcoal }}
                    >
                      {editingGasto ? 'Editar Gasto' : 'Nuevo Gasto'}
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowGastoForm(false)}
                    className="inline-flex items-center justify-center h-8 w-8 rounded transition-colors"
                    style={{ color: TOKENS.slate500 }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form
                  onSubmit={handleSaveGasto}
                  className="p-5 space-y-3"
                  style={{ background: TOKENS.bg }}
                >
                  <div>
                    <label className="pm-label">Nombre</label>
                    <input
                      type="text"
                      value={gastoForm.nombre}
                      onChange={(e) =>
                        setGastoForm({ ...gastoForm, nombre: e.target.value })
                      }
                      className="pm-input"
                      required
                    />
                  </div>
                  <div>
                    <label className="pm-label">Monto (USD)</label>
                    <input
                      type="number"
                      value={gastoForm.montoUSD}
                      onChange={(e) =>
                        setGastoForm({
                          ...gastoForm,
                          montoUSD: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="pm-input pm-tnum"
                      step="0.01"
                      min="0"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="pm-label">Categoría</label>
                      <select
                        value={gastoForm.categoria}
                        onChange={(e) =>
                          setGastoForm({
                            ...gastoForm,
                            categoria: e.target.value as 'fijo' | 'variable',
                          })
                        }
                        className="pm-input"
                      >
                        <option value="fijo">Fijo</option>
                        <option value="variable">Variable</option>
                      </select>
                    </div>
                    <div>
                      <label className="pm-label">Frecuencia</label>
                      <select
                        value={gastoForm.frecuencia}
                        onChange={(e) =>
                          setGastoForm({
                            ...gastoForm,
                            frecuencia: e.target.value as 'mensual' | 'semanal' | 'diario',
                          })
                        }
                        className="pm-input"
                      >
                        <option value="mensual">Mensual</option>
                        <option value="semanal">Semanal</option>
                        <option value="diario">Diario</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="pm-label">Notas (opcional)</label>
                    <textarea
                      value={gastoForm.notas}
                      onChange={(e) =>
                        setGastoForm({ ...gastoForm, notas: e.target.value })
                      }
                      className="pm-input"
                      rows={2}
                    />
                  </div>
                  <div
                    className="flex gap-2 pt-3"
                    style={{ borderTop: `1px solid ${TOKENS.slate200}` }}
                  >
                    <PMBtnSecondary
                      type="button"
                      onClick={() => setShowGastoForm(false)}
                      className="flex-1"
                    >
                      Cancelar
                    </PMBtnSecondary>
                    <PMBtnPrimary type="submit" className="flex-1">
                      {editingGasto ? 'Actualizar' : 'Guardar'}
                    </PMBtnPrimary>
                  </div>
                </form>
              </div>
            </div>
          </PMScope>
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

function KpiCard({
  label,
  value,
  icon,
  hint,
  footer,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  hint?: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="pm-card px-4 py-3">
      <div className="pm-eyebrow flex items-center justify-between">
        <span>{label}</span>
        <span style={{ color: TOKENS.slate400 }}>{icon}</span>
      </div>
      <div
        className="pm-tnum text-[24px] font-bold leading-8 tracking-[-0.02em] mt-1"
        style={{ color: TOKENS.charcoal }}
      >
        {value}
      </div>
      {hint && (
        <div className="text-[12px] mt-0.5" style={{ color: TOKENS.slate500 }}>
          {hint}
        </div>
      )}
      {footer && <div className="mt-2">{footer}</div>}
    </div>
  );
}

function MicroStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'danger';
}) {
  const color =
    tone === 'success' ? TOKENS.green : tone === 'danger' ? TOKENS.red : TOKENS.charcoal;
  return (
    <div>
      <div className="pm-eyebrow">{label}</div>
      <div
        className="pm-tnum font-bold text-[15px] mt-0.5"
        style={{ color }}
      >
        {value}
      </div>
    </div>
  );
}

function ConfRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: TOKENS.slate500 }}>{label}:</span>
      <span className="pm-tnum font-semibold" style={{ color: TOKENS.charcoal }}>
        {value}
      </span>
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
