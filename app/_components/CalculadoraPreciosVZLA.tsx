"use client";

import React, { useState, useEffect } from 'react';
import {
  Calculator,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  RefreshCcw,
  Save,
  History,
  Percent,
  ArrowRightLeft,
  Wifi,
  Clock,
  X,
} from 'lucide-react';
import { useFinanzasVZLA, CalculoOutput } from '@/app/_hooks/useFinanzasVZLA';
import { useSincronizacionTasas } from '@/app/_hooks/useSincronizacionTasas';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/app/_db/db';
import { useNotifications } from '@/app/_components/NotificationProvider';
import { useTasas } from '@/app/_contexts/TasasContext';
import {
  PMScope,
  TOKENS,
  PM_FONT,
  PMBtnPrimary,
  PMBtnSecondary,
} from '@/app/_components/_pmTheme';

// ============================================================================
// TYPES
// ============================================================================

interface ProductoCalculoRow {
  id: number;
  sku: string;
  nombre: string;
  costoUSD: number;
  sinCosto: boolean;
}

// ============================================================================
// CURRENCY INPUT
// ============================================================================

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  placeholder?: string;
  compact?: boolean;
}

const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  prefix,
  suffix,
  min = 0,
  max,
  step = 0.01,
  className = '',
  placeholder = '0.00',
  compact,
}) => {
  const [displayValue, setDisplayValue] = useState<string>(value.toFixed(2));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) setDisplayValue(value.toFixed(2));
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9.]/g, '');
    setDisplayValue(rawValue);
    const numValue = parseFloat(rawValue);
    if (!isNaN(numValue)) {
      let finalValue = numValue;
      if (min !== undefined && numValue < min) finalValue = min;
      if (max !== undefined && numValue > max) finalValue = max;
      onChange(finalValue);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {prefix && (
        <span
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] font-bold pointer-events-none"
          style={{ color: TOKENS.slate500 }}
        >
          {prefix}
        </span>
      )}
      <input
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onFocus={() => {
          setIsFocused(true);
          setDisplayValue(value.toString());
        }}
        onBlur={() => {
          setIsFocused(false);
          setDisplayValue(value.toFixed(2));
        }}
        placeholder={placeholder}
        className="pm-input pm-tnum text-right"
        style={{
          paddingLeft: prefix ? '2.25rem' : undefined,
          paddingRight: suffix ? '2.25rem' : undefined,
          height: compact ? '32px' : undefined,
        }}
      />
      {suffix && (
        <span
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold uppercase tracking-wider pointer-events-none"
          style={{ color: TOKENS.slate400 }}
        >
          {suffix}
        </span>
      )}
    </div>
  );
};

// ============================================================================
// MAIN
// ============================================================================

export default function CalculadoraPreciosVZLA() {
  const {
    tasaBCV,
    setTasaBCV,
    tasaParalelo,
    setTasaParalelo,
    margenGlobal,
    setMargenGlobal,
    factorProteccionActual,
    brechaActual,
    calcularPrecio,
    formatearBs,
    formatearUSD,
    formatearPorcentaje,
    formatearNumero,
    guardarConfiguracion,
    registrarTasaHistorial,
    configActiva,
    historialTasas,
  } = useFinanzasVZLA();

  const {
    sincronizar,
    estaCargando: sincronizando,
    formatoTiempoTranscurrido,
  } = useSincronizacionTasas();

  const { success, error: showError } = useNotifications();
  const { tasas, recargarTasas } = useTasas();

  const productosDB = useLiveQuery(() => db.products.toArray(), []);

  const [productos, setProductos] = useState<ProductoCalculoRow[]>([]);
  const [calculos, setCalculos] = useState<CalculoOutput[]>([]);
  const [showHistorial, setShowHistorial] = useState(false);
  const [tasasSincronizadas, setTasasSincronizadas] = useState(false);
  const [origenTasas, setOrigenTasas] = useState<'api' | 'config' | 'manual'>('manual');

  useEffect(() => {
    if (configActiva) {
      setTasaBCV(configActiva.tasaBCV);
      setTasaParalelo(configActiva.tasaParalelo);
      setMargenGlobal(configActiva.margenGlobal);
      setOrigenTasas('config');
      setTasasSincronizadas(true);
    }
  }, [configActiva, setTasaBCV, setTasaParalelo, setMargenGlobal]);

  useEffect(() => {
    if (tasas && !tasasSincronizadas) {
      setTasaBCV(tasas.bcv);
      setTasaParalelo(tasas.paralelo);
      setTasasSincronizadas(true);
      setOrigenTasas('api');
    }
  }, [tasas, tasasSincronizadas, setTasaBCV, setTasaParalelo]);

  useEffect(() => {
    recargarTasas();
  }, [recargarTasas]);

  useEffect(() => {
    if (productosDB) {
      setProductos(
        productosDB.map((p) => ({
          id: p.id!,
          sku: p.sku,
          nombre: p.name,
          costoUSD: p.costUsd || 0,
          sinCosto: !p.costUsd || p.costUsd === 0,
        })),
      );
    }
  }, [productosDB]);

  useEffect(() => {
    setCalculos(
      productos.map((p) =>
        calcularPrecio({
          costoUSD: p.costoUSD,
          margenPorcentaje: margenGlobal,
          tasaBCV,
          tasaParalelo,
        }),
      ),
    );
  }, [productos, tasaBCV, tasaParalelo, margenGlobal, calcularPrecio]);

  const handleCostoChange = (index: number, nuevoCosto: number) => {
    const nuevos = [...productos];
    nuevos[index] = { ...nuevos[index], costoUSD: nuevoCosto, sinCosto: nuevoCosto === 0 };
    setProductos(nuevos);
  };

  const handleGuardarConfiguracion = async () => {
    try {
      await guardarConfiguracion({
        tasaBCV,
        tasaParalelo,
        margenGlobal,
        fecha: new Date(),
        esActiva: true,
      });
      setOrigenTasas('config');
      success('Configuración guardada', 'Las tasas y margen han sido guardados');
    } catch {
      showError('Error', 'No se pudo guardar la configuración');
    }
  };

  const handleRegistrarTasa = async () => {
    try {
      await registrarTasaHistorial(tasaBCV, tasaParalelo, 'Manual');
      success('Tasa registrada', 'La tasa ha sido guardada en el historial');
    } catch {
      showError('Error', 'No se pudo registrar la tasa');
    }
  };

  const handleSincronizarDesdeAPI = async () => {
    try {
      const resultado = await sincronizar();
      setTasaBCV(resultado.tasas.bcv);
      setTasaParalelo(resultado.tasas.paralelo);
      setTasasSincronizadas(true);
      setOrigenTasas('api');
      success(
        'Tasas actualizadas',
        `BCV: ${resultado.tasas.bcv.toFixed(2)} | Paralelo: ${resultado.tasas.paralelo.toFixed(
          2,
        )}${resultado.desdeCache ? ' (desde caché)' : ''}`,
      );
    } catch (err: any) {
      showError('Error', err.message || 'No se pudo sincronizar las tasas');
    }
  };

  const estadisticas = React.useMemo(() => {
    const calculosValidos = calculos.filter((_, i) => !productos[i]?.sinCosto);
    if (calculosValidos.length === 0) return null;
    return {
      totalProductos: calculosValidos.length,
      productosSinCosto: productos.filter((p) => p.sinCosto).length,
      productosConPerdida: calculosValidos.filter((c) => c.esPerdida).length,
      productosGananciaBaja: calculosValidos.filter((c) => c.esGananciaBaja).length,
      promedioGananciaReal:
        calculosValidos.reduce((a, c) => a + c.gananciaRealUSD, 0) / calculosValidos.length,
      perdidaTotalPorBrecha: calculosValidos.reduce((sum, c) => sum + c.perdidaPorBrechaUSD, 0),
      gananciaEsperadaTotal: calculosValidos.reduce((sum, c) => sum + c.gananciaEsperadaUSD, 0),
      gananciaRealTotal: calculosValidos.reduce((sum, c) => sum + c.gananciaRealUSD, 0),
    };
  }, [calculos, productos]);

  const origenMeta = {
    api: {
      icon: <Wifi className="h-3 w-3" />,
      text: `Desde API · ${formatoTiempoTranscurrido()}`,
      bg: TOKENS.greenSoft,
      color: TOKENS.green,
    },
    config: {
      icon: <Save className="h-3 w-3" />,
      text: 'Desde configuración guardada',
      bg: TOKENS.slate100,
      color: TOKENS.charcoal,
    },
    manual: {
      icon: <AlertTriangle className="h-3 w-3" />,
      text: 'Ingresado manualmente',
      bg: TOKENS.amberSoft,
      color: TOKENS.amber,
    },
  }[origenTasas];

  return (
    <PMScope
      className="min-h-screen"
      style={{ background: TOKENS.bg, fontFamily: PM_FONT }}
    >
      <div className="max-w-[1440px] mx-auto px-6 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <div
              className="text-[11px] font-bold uppercase tracking-[0.05em] mb-1"
              style={{ color: TOKENS.slate500 }}
            >
              Finanzas / Pricing Venezuela
            </div>
            <div className="flex items-center gap-2.5">
              <div
                className="flex items-center justify-center h-9 w-9 rounded"
                style={{ background: TOKENS.charcoal, color: '#fff' }}
              >
                <Calculator className="h-4 w-4" />
              </div>
              <div>
                <h1
                  className="text-[24px] font-bold leading-8 tracking-[-0.02em]"
                  style={{ color: TOKENS.charcoal }}
                >
                  Calculadora de Precios Venezuela
                </h1>
                <p className="text-[13px]" style={{ color: TOKENS.slate500 }}>
                  Gestión de precios considerando brecha cambiaria BCV vs Paralelo
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <PMBtnSecondary onClick={() => setShowHistorial(!showHistorial)}>
              <History className="h-4 w-4" />
              {showHistorial ? 'Ocultar Historial' : 'Ver Historial'}
            </PMBtnSecondary>
            <PMBtnPrimary
              onClick={handleSincronizarDesdeAPI}
              disabled={sincronizando}
            >
              {sincronizando ? (
                <RefreshCcw className="h-4 w-4 animate-spin" />
              ) : (
                <Wifi className="h-4 w-4" />
              )}
              {sincronizando ? 'Sincronizando…' : 'Sincronizar API'}
            </PMBtnPrimary>
          </div>
        </div>

        {/* Configuración Cambiaria */}
        <section
          className="rounded p-5"
          style={{
            background: '#fff',
            border: `1px solid ${TOKENS.slate200}`,
            boxShadow: '0 1px 2px rgba(18, 24, 38, 0.04)',
          }}
        >
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <h2
              className="text-[11px] font-bold uppercase tracking-[0.05em] flex items-center gap-2"
              style={{ color: TOKENS.slate700 }}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Configuración Cambiaria
            </h2>
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider"
              style={{ background: origenMeta.bg, color: origenMeta.color }}
            >
              {origenMeta.icon}
              {origenMeta.text}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Tasa BCV */}
            <div>
              <label className="pm-label">Tasa BCV (Oficial)</label>
              <CurrencyInput
                value={tasaBCV}
                onChange={(v) => {
                  setTasaBCV(v);
                  setOrigenTasas('manual');
                }}
                prefix="Bs."
              />
            </div>

            {/* Tasa Paralelo */}
            <div>
              <label className="pm-label">Tasa Paralelo</label>
              <CurrencyInput
                value={tasaParalelo}
                onChange={(v) => {
                  setTasaParalelo(v);
                  setOrigenTasas('manual');
                }}
                prefix="Bs."
              />
            </div>

            {/* Factor */}
            <div
              className="rounded px-3 py-2"
              style={{ background: TOKENS.slate50, border: `1px solid ${TOKENS.slate200}` }}
            >
              <div
                className="text-[11px] font-bold uppercase tracking-[0.05em]"
                style={{ color: TOKENS.slate500 }}
              >
                Factor Protección
              </div>
              <div
                className="pm-tnum font-bold text-[20px] leading-7 tracking-[-0.01em]"
                style={{ color: TOKENS.charcoal }}
              >
                {formatearNumero(factorProteccionActual, 3)}
              </div>
            </div>

            {/* Brecha */}
            <div
              className="rounded px-3 py-2"
              style={{
                background: brechaActual > 5 ? TOKENS.redSoft : TOKENS.greenSoft,
                border: `1px solid ${brechaActual > 5 ? TOKENS.red : TOKENS.green}`,
              }}
            >
              <div
                className="text-[11px] font-bold uppercase tracking-[0.05em]"
                style={{ color: brechaActual > 5 ? TOKENS.red : TOKENS.green }}
              >
                Brecha Cambiaria
              </div>
              <div
                className="pm-tnum font-bold text-[20px] leading-7 tracking-[-0.01em]"
                style={{ color: brechaActual > 5 ? TOKENS.red : TOKENS.green }}
              >
                {formatearPorcentaje(brechaActual, 2)}
              </div>
            </div>
          </div>

          {/* Margen Global + acciones */}
          <div
            className="mt-4 pt-4 flex items-end gap-4 flex-wrap"
            style={{ borderTop: `1px solid ${TOKENS.slate200}` }}
          >
            <div className="w-56">
              <label className="pm-label">
                <Percent className="h-3 w-3 inline mr-1" />
                Margen de Ganancia Global
              </label>
              <CurrencyInput
                value={margenGlobal}
                onChange={setMargenGlobal}
                suffix="%"
                min={0}
                max={99}
                step={0.5}
              />
            </div>

            <div className="flex gap-2">
              <PMBtnPrimary onClick={handleGuardarConfiguracion}>
                <Save className="h-4 w-4" />
                Guardar Config.
              </PMBtnPrimary>
              <PMBtnSecondary onClick={handleRegistrarTasa}>
                <Clock className="h-4 w-4" />
                Registrar Tasa
              </PMBtnSecondary>
            </div>
          </div>
        </section>

        {/* Historial */}
        {showHistorial && (
          <section
            className="rounded overflow-hidden"
            style={{
              background: '#fff',
              border: `1px solid ${TOKENS.slate200}`,
              boxShadow: '0 1px 2px rgba(18, 24, 38, 0.04)',
            }}
          >
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{ borderBottom: `1px solid ${TOKENS.slate200}`, background: TOKENS.slate50 }}
            >
              <div className="flex items-center gap-2">
                <History className="h-4 w-4" style={{ color: TOKENS.slate500 }} />
                <span
                  className="text-[11px] font-bold uppercase tracking-[0.05em]"
                  style={{ color: TOKENS.slate700 }}
                >
                  Historial de Tasas
                </span>
              </div>
              <div className="flex items-center gap-3">
                {historialTasas && (
                  <span className="text-[12px] pm-tnum" style={{ color: TOKENS.slate500 }}>
                    {historialTasas.length} registros
                  </span>
                )}
                <button
                  onClick={() => setShowHistorial(false)}
                  className="inline-flex items-center justify-center h-7 w-7 rounded"
                  style={{ color: TOKENS.slate500 }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            {!historialTasas || historialTasas.length === 0 ? (
              <p className="px-6 py-8 text-center text-[13px]" style={{ color: TOKENS.slate500 }}>
                No hay tasas registradas aún. Usa "Registrar Tasa" o "Sincronizar API".
              </p>
            ) : (
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="min-w-full text-[13px]">
                  <thead className="sticky top-0 z-10">
                    <tr style={{ background: TOKENS.slate100 }}>
                      <Th>Fecha</Th>
                      <Th align="right">BCV</Th>
                      <Th align="right">Paralelo</Th>
                      <Th align="right">Brecha</Th>
                      <Th>Fuente</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {historialTasas.map((t) => (
                      <tr
                        key={t.id}
                        style={{ borderTop: `1px solid ${TOKENS.slate200}` }}
                      >
                        <Td>
                          <span className="pm-tnum">
                            {new Date(t.fecha).toLocaleDateString('es-VE', {
                              day: '2-digit',
                              month: 'short',
                              year: '2-digit',
                            })}{' '}
                            {t.hora}
                          </span>
                        </Td>
                        <Td align="right">
                          <span className="pm-tnum">{formatearNumero(t.tasaBCV, 2)}</span>
                        </Td>
                        <Td align="right">
                          <span className="pm-tnum">{formatearNumero(t.tasaParalelo, 2)}</span>
                        </Td>
                        <Td align="right">
                          <span
                            className="pm-tnum font-bold"
                            style={{ color: t.brecha > 5 ? TOKENS.red : TOKENS.green }}
                          >
                            {formatearPorcentaje(t.brecha, 2)}
                          </span>
                        </Td>
                        <Td>
                          <span
                            className="text-[11px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                            style={{ background: TOKENS.slate100, color: TOKENS.slate500 }}
                          >
                            {t.fuente || 'Manual'}
                          </span>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* KPIs */}
        {estadisticas && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPI
              label="Productos"
              value={estadisticas.totalProductos.toString()}
              hint={
                estadisticas.productosSinCosto > 0
                  ? `+${estadisticas.productosSinCosto} sin costo definido`
                  : 'Con costo definido'
              }
              hintTone={estadisticas.productosSinCosto > 0 ? 'warn' : undefined}
            />
            <KPI
              label="Con Pérdida"
              value={estadisticas.productosConPerdida.toString()}
              hint={
                estadisticas.productosConPerdida > 0
                  ? 'Requieren ajuste de precio'
                  : 'Sin productos en pérdida'
              }
              tone={estadisticas.productosConPerdida > 0 ? 'danger' : undefined}
            />
            <KPI
              label="Ganancia Baja"
              value={estadisticas.productosGananciaBaja.toString()}
              hint="Menos del 5%"
              tone={estadisticas.productosGananciaBaja > 0 ? 'warn' : undefined}
            />
            <KPI
              label="Pérdida por Brecha"
              value={formatearUSD(estadisticas.perdidaTotalPorBrecha)}
              hint="Diferencial cambiario"
              tone="danger"
            />
          </div>
        )}

        {/* Tabla de Productos */}
        <section
          className="rounded overflow-hidden"
          style={{
            background: '#fff',
            border: `1px solid ${TOKENS.slate200}`,
            boxShadow: '0 1px 2px rgba(18, 24, 38, 0.04)',
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{ borderBottom: `1px solid ${TOKENS.slate200}`, background: TOKENS.slate50 }}
          >
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" style={{ color: TOKENS.slate500 }} />
              <span
                className="text-[11px] font-bold uppercase tracking-[0.05em]"
                style={{ color: TOKENS.slate700 }}
              >
                Cálculo de Precios por Producto
              </span>
            </div>
            <span className="text-[12px] pm-tnum" style={{ color: TOKENS.slate500 }}>
              {productos.length} filas
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-[13px]">
              <thead className="sticky top-0 z-10">
                <tr style={{ background: TOKENS.slate100 }}>
                  <Th>Producto</Th>
                  <Th align="right">Costo ($)</Th>
                  <Th align="right" title="Costo ajustado por brecha cambiaria">
                    Precio Idea ($)
                  </Th>
                  <Th align="right">Precio Base ($)</Th>
                  <Th align="right">Precio en Bs.</Th>
                  <Th align="right">Ganancia Real</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody>
                {productos.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-[13px]"
                      style={{ color: TOKENS.slate500 }}
                    >
                      No hay productos en el inventario
                    </td>
                  </tr>
                ) : (
                  productos.map((producto, index) => {
                    const calculo = calculos[index];

                    if (producto.sinCosto) {
                      return (
                        <tr
                          key={producto.id}
                          style={{
                            borderTop: `1px solid ${TOKENS.slate200}`,
                            background: TOKENS.slate50,
                          }}
                        >
                          <Td>
                            <div
                              className="font-semibold leading-tight"
                              style={{ color: TOKENS.slate500 }}
                            >
                              {producto.nombre}
                            </div>
                            <div
                              className="font-mono text-[11px] mt-0.5"
                              style={{ color: TOKENS.slate400 }}
                            >
                              {producto.sku}
                            </div>
                          </Td>
                          <Td align="right">
                            <CurrencyInput
                              value={producto.costoUSD}
                              onChange={(value) => handleCostoChange(index, value)}
                              prefix="$"
                              className="w-32 inline-block"
                            />
                          </Td>
                          <td
                            colSpan={5}
                            className="px-3 py-2.5 text-center"
                          >
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider"
                              style={{ background: TOKENS.amberSoft, color: TOKENS.amber }}
                            >
                              <AlertTriangle className="h-3 w-3" />
                              Sin costo definido — ingresa el costo para ver los cálculos
                            </span>
                          </td>
                        </tr>
                      );
                    }

                    if (!calculo) return null;

                    const rowBg = calculo.esPerdida
                      ? TOKENS.redSoft
                      : calculo.esGananciaBaja
                      ? TOKENS.amberSoft
                      : undefined;

                    return (
                      <tr
                        key={producto.id}
                        style={{
                          borderTop: `1px solid ${TOKENS.slate200}`,
                          background: rowBg,
                        }}
                      >
                        <Td>
                          <div
                            className="font-semibold leading-tight"
                            style={{ color: TOKENS.charcoal }}
                          >
                            {producto.nombre}
                          </div>
                          <div
                            className="font-mono text-[11px] mt-0.5"
                            style={{ color: TOKENS.slate500 }}
                          >
                            {producto.sku}
                          </div>
                        </Td>
                        <Td align="right">
                          <CurrencyInput
                            value={producto.costoUSD}
                            onChange={(value) => handleCostoChange(index, value)}
                            prefix="$"
                            className="w-32 inline-block"
                          />
                        </Td>
                        <Td align="right">
                          <div
                            className="pm-tnum font-bold"
                            style={{
                              color: calculo.precioIdeaMenorAlCosto ? TOKENS.red : TOKENS.charcoal,
                            }}
                            title={`Costo × ${calculo.factorProteccion.toFixed(
                              4,
                            )} = $${calculo.precioIdea.toFixed(2)}`}
                          >
                            {formatearUSD(calculo.precioIdea)}
                          </div>
                          {calculo.precioIdeaMenorAlCosto && (
                            <div
                              className="text-[11px] flex items-center justify-end gap-1 mt-0.5"
                              style={{ color: TOKENS.red }}
                            >
                              <AlertTriangle className="h-3 w-3" />
                              Menor al costo
                            </div>
                          )}
                          <div
                            className="text-[11px] pm-tnum mt-0.5"
                            style={{ color: TOKENS.slate400 }}
                          >
                            f {calculo.factorProteccion.toFixed(4)}
                          </div>
                        </Td>
                        <Td align="right">
                          <div
                            className="pm-tnum font-bold"
                            style={{ color: TOKENS.charcoal }}
                          >
                            {formatearUSD(calculo.precioBaseUSD)}
                          </div>
                          <div
                            className="text-[11px] mt-0.5"
                            style={{ color: TOKENS.slate500 }}
                          >
                            Margen: {formatearPorcentaje(calculo.margenPorcentaje)}
                          </div>
                        </Td>
                        <Td align="right">
                          <div>
                            <div
                              className="text-[11px] font-bold uppercase tracking-wider"
                              style={{ color: TOKENS.charcoal }}
                            >
                              Con protección
                            </div>
                            <div
                              className="pm-tnum font-bold"
                              style={{ color: TOKENS.charcoal }}
                            >
                              {formatearBs(calculo.precioVentaBsProtegido)}
                            </div>
                            <div
                              className="text-[11px] font-bold uppercase tracking-wider mt-1"
                              style={{ color: TOKENS.slate500 }}
                            >
                              Sin protección
                            </div>
                            <div
                              className="pm-tnum text-[12px]"
                              style={{ color: TOKENS.slate500 }}
                            >
                              {formatearBs(calculo.precioVentaBsSinProteccion)}
                            </div>
                          </div>
                        </Td>
                        <Td align="right">
                          <div
                            className="pm-tnum font-bold"
                            style={{
                              color: calculo.gananciaRealUSD < 0 ? TOKENS.red : TOKENS.green,
                            }}
                          >
                            {formatearUSD(calculo.gananciaRealUSD)}
                          </div>
                          <div
                            className="text-[11px] pm-tnum mt-0.5"
                            style={{
                              color: calculo.gananciaRealPorcentaje < 5 ? TOKENS.red : TOKENS.green,
                            }}
                          >
                            {formatearPorcentaje(calculo.gananciaRealPorcentaje, 1)}
                          </div>
                        </Td>
                        <Td>
                          {calculo.esPerdida ? (
                            <StatusBadge tone="danger" icon={<TrendingDown className="h-3 w-3" />}>
                              Pérdida
                            </StatusBadge>
                          ) : calculo.esGananciaBaja ? (
                            <StatusBadge tone="warn" icon={<AlertTriangle className="h-3 w-3" />}>
                              Baja
                            </StatusBadge>
                          ) : (
                            <StatusBadge tone="success" icon={<TrendingUp className="h-3 w-3" />}>
                              OK
                            </StatusBadge>
                          )}
                        </Td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Análisis Detallado */}
        {estadisticas && (
          <section
            className="rounded p-5"
            style={{
              background: '#fff',
              border: `1px solid ${TOKENS.slate200}`,
              boxShadow: '0 1px 2px rgba(18, 24, 38, 0.04)',
            }}
          >
            <h3
              className="text-[11px] font-bold uppercase tracking-[0.05em] mb-4"
              style={{ color: TOKENS.slate700 }}
            >
              Análisis de Impacto · Brecha Cambiaria
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <AnalysisCard
                label="Sin Brecha (Ideal)"
                value={formatearUSD(estadisticas.gananciaEsperadaTotal)}
                hint="Ganancia total esperada"
                tone="neutral"
              />
              <AnalysisCard
                label="Con Protección"
                value={formatearUSD(estadisticas.gananciaRealTotal)}
                hint="Ganancia real con factor"
                tone="success"
              />
              <AnalysisCard
                label="Pérdida por Brecha"
                value={formatearUSD(estadisticas.perdidaTotalPorBrecha)}
                hint="Diferencial cambiario"
                tone="danger"
              />
            </div>
          </section>
        )}
      </div>
    </PMScope>
  );
}

// ============================================================================
// LITTLE COMPONENTS
// ============================================================================

function Th({
  children,
  align = 'left',
  title,
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
  title?: string;
}) {
  return (
    <th
      className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.05em] select-none"
      style={{
        color: TOKENS.slate700,
        borderBottom: `1px solid ${TOKENS.slate200}`,
        textAlign: align,
      }}
      title={title}
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

function KPI({
  label,
  value,
  hint,
  tone,
  hintTone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'warn' | 'danger';
  hintTone?: 'warn' | 'danger';
}) {
  const valueColor =
    tone === 'danger' ? TOKENS.red : tone === 'warn' ? TOKENS.amber : TOKENS.charcoal;
  const hintColor =
    hintTone === 'danger'
      ? TOKENS.red
      : hintTone === 'warn'
      ? TOKENS.amber
      : TOKENS.slate500;
  return (
    <div
      className="bg-white rounded px-4 py-3"
      style={{ border: `1px solid ${TOKENS.slate200}` }}
    >
      <div
        className="text-[11px] font-bold uppercase tracking-[0.05em]"
        style={{ color: TOKENS.slate500 }}
      >
        {label}
      </div>
      <div
        className="pm-tnum text-[24px] font-bold leading-8 tracking-[-0.02em] mt-1"
        style={{ color: valueColor }}
      >
        {value}
      </div>
      {hint && (
        <div className="text-[12px] mt-0.5" style={{ color: hintColor }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  tone,
  icon,
  children,
}: {
  tone: 'success' | 'warn' | 'danger';
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const colors = {
    success: { bg: TOKENS.greenSoft, color: TOKENS.green },
    warn: { bg: TOKENS.amberSoft, color: TOKENS.amber },
    danger: { bg: TOKENS.redSoft, color: TOKENS.red },
  }[tone];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider"
      style={{ background: colors.bg, color: colors.color }}
    >
      {icon}
      {children}
    </span>
  );
}

function AnalysisCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: 'neutral' | 'success' | 'danger';
}) {
  const colors = {
    neutral: { color: TOKENS.charcoal, accent: TOKENS.slate200 },
    success: { color: TOKENS.green, accent: TOKENS.green },
    danger: { color: TOKENS.red, accent: TOKENS.red },
  }[tone];
  return (
    <div
      className="rounded px-4 py-3"
      style={{
        background: '#fff',
        border: `1px solid ${TOKENS.slate200}`,
        borderLeft: `3px solid ${colors.accent}`,
      }}
    >
      <div
        className="text-[11px] font-bold uppercase tracking-[0.05em]"
        style={{ color: TOKENS.slate500 }}
      >
        {label}
      </div>
      <div
        className="pm-tnum font-bold text-[24px] leading-8 tracking-[-0.02em] mt-0.5"
        style={{ color: colors.color }}
      >
        {value}
      </div>
      <div className="text-[12px] mt-0.5" style={{ color: TOKENS.slate500 }}>
        {hint}
      </div>
    </div>
  );
}
